use crate::game::{Action, Game, Phase, RecipeId, Snapshot, StationId};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::{
    sync::{mpsc, oneshot},
    time::{self, MissedTickBehavior},
};

type Reply = Result<Snapshot, String>;

enum Request {
    Snapshot,
    Apply(Action),
}

struct Message {
    request: Request,
    reply: oneshot::Sender<Reply>,
}

pub struct Engine(mpsc::Sender<Message>);

impl Engine {
    pub fn launch(app: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel(32);
        tauri::async_runtime::spawn(run(app, receiver));
        Self(sender)
    }

    async fn ask(&self, request: Request) -> Reply {
        let (reply, response) = oneshot::channel();
        self.0
            .send(Message { request, reply })
            .await
            .map_err(|_| "The kitchen engine has stopped.".to_string())?;
        response
            .await
            .map_err(|_| "The kitchen engine has stopped.".to_string())?
    }
}

async fn run(app: AppHandle, mut receiver: mpsc::Receiver<Message>) {
    let clock = Instant::now();
    let mut timer = time::interval(Duration::from_millis(100));
    timer.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut game = Game::new();

    loop {
        tokio::select! {
            _ = timer.tick() => {
                if game.snapshot.phase == Phase::Running {
                    game.advance_to(clock.elapsed().as_millis() as u64);
                    publish(&app, &mut game);
                }
            }
            message = receiver.recv() => {
                let Some(message) = message else { break };
                let result = match message.request {
                    Request::Snapshot => Ok(game.snapshot.clone()),
                    Request::Apply(action) => {
                        game.advance_to(clock.elapsed().as_millis() as u64);
                        let result = game.apply(action);
                        publish(&app, &mut game);
                        result.map(|_| game.snapshot.clone()).map_err(str::to_string)
                    }
                };
                let _ = message.reply.send(result);
            }
        }
    }
}

fn publish(app: &AppHandle, game: &mut Game) {
    game.snapshot.revision += 1;
    let _ = app.emit("game-state", &game.snapshot);
}

#[tauri::command]
pub async fn get_game_state(engine: State<'_, Engine>) -> Reply {
    engine.ask(Request::Snapshot).await
}

#[tauri::command]
pub async fn start_shift(engine: State<'_, Engine>) -> Reply {
    engine.ask(Request::Apply(Action::StartShift)).await
}

#[tauri::command]
pub async fn start_cooking(
    engine: State<'_, Engine>,
    station_id: StationId,
    recipe_id: RecipeId,
) -> Reply {
    engine
        .ask(Request::Apply(Action::StartCooking(station_id, recipe_id)))
        .await
}

#[tauri::command]
pub async fn serve_order(
    engine: State<'_, Engine>,
    customer_id: u32,
    station_id: StationId,
) -> Reply {
    engine
        .ask(Request::Apply(Action::ServeOrder(customer_id, station_id)))
        .await
}

#[tauri::command]
pub async fn discard_item(engine: State<'_, Engine>, station_id: StationId) -> Reply {
    engine
        .ask(Request::Apply(Action::DiscardItem(station_id)))
        .await
}
