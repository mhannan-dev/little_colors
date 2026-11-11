use super::game::{Action, Game, Phase, RecipeId, Snapshot, StationId};
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
    SetVisible(bool),
}

struct Message {
    request: Request,
    reply: oneshot::Sender<Reply>,
}

pub struct Engine(mpsc::Sender<Message>);

impl Engine {
    pub fn launch(app: AppHandle, visible: bool) -> Self {
        let (sender, receiver) = mpsc::channel(32);
        tauri::async_runtime::spawn(run(app, receiver, visible));
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

struct ShiftClock {
    anchor: Option<Instant>,
    elapsed: Duration,
}

impl ShiftClock {
    fn now_ms(&self, now: Instant) -> u64 {
        (self.elapsed
            + self.anchor.map_or(Duration::ZERO, |anchor| {
                now.saturating_duration_since(anchor)
            }))
        .as_millis() as u64
    }

    fn set_visible(&mut self, visible: bool, now: Instant) {
        if visible {
            self.anchor.get_or_insert(now);
        } else if let Some(anchor) = self.anchor.take() {
            self.elapsed += now.saturating_duration_since(anchor);
        }
    }
}

async fn run(app: AppHandle, mut receiver: mpsc::Receiver<Message>, visible: bool) {
    let mut clock = ShiftClock {
        anchor: visible.then(Instant::now),
        elapsed: Duration::ZERO,
    };
    let mut timer = time::interval(Duration::from_millis(100));
    timer.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut game = Game::new();

    loop {
        tokio::select! {
            _ = timer.tick() => {
                if clock.anchor.is_some() && game.snapshot.phase == Phase::Running {
                    game.advance_to(clock.now_ms(Instant::now()));
                    publish(&app, &mut game);
                }
            }
            message = receiver.recv() => {
                let Some(message) = message else { break };
                let now = Instant::now();
                let result = match message.request {
                    Request::Snapshot => Ok(game.snapshot.clone()),
                    Request::SetVisible(visible) => {
                        clock.set_visible(visible, now);
                        game.advance_to(clock.now_ms(now));
                        Ok(game.snapshot.clone())
                    }
                    Request::Apply(_) if clock.anchor.is_none() => Err("Open Counter Rush before playing.".into()),
                    Request::Apply(action) => {
                        game.advance_to(clock.now_ms(now));
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

#[cfg(test)]
mod clock_tests {
    use super::*;

    #[test]
    fn leaving_and_reopening_the_kitchen_excludes_hidden_time() {
        let start = Instant::now();
        let mut clock = ShiftClock {
            anchor: Some(start),
            elapsed: Duration::ZERO,
        };
        clock.set_visible(false, start + Duration::from_secs(3));
        assert_eq!(clock.now_ms(start + Duration::from_secs(30)), 3_000);
        clock.set_visible(true, start + Duration::from_secs(30));
        clock.set_visible(true, start + Duration::from_secs(31));
        assert_eq!(clock.now_ms(start + Duration::from_secs(32)), 5_000);
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
pub async fn set_counter_rush_visible(engine: State<'_, Engine>, visible: bool) -> Reply {
    engine.ask(Request::SetVisible(visible)).await
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
