use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const SHIFT_CUSTOMERS: usize = 8;
const COUNTER_CAPACITY: usize = 4;
const ARRIVAL_INTERVAL_MS: u64 = 5_000;
const CUSTOMER_NAMES: [&str; SHIFT_CUSTOMERS] =
    ["Maya", "Leo", "Nora", "Jules", "Kai", "Ari", "Sam", "Zoe"];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StationId {
    Grill,
    DrinkMachine,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecipeId {
    Burger,
    Lemonade,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: RecipeId,
    pub name: &'static str,
    pub station_id: StationId,
    pub cook_ms: u64,
    pub coins: u32,
}

const RECIPES: [Recipe; 2] = [
    Recipe {
        id: RecipeId::Burger,
        name: "Burger",
        station_id: StationId::Grill,
        cook_ms: 3_500,
        coins: 12,
    },
    Recipe {
        id: RecipeId::Lemonade,
        name: "Lemonade",
        station_id: StationId::DrinkMachine,
        cook_ms: 1_500,
        coins: 6,
    },
];

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedItem {
    pub recipe_id: RecipeId,
    pub started_at_ms: u64,
    pub ready_at_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
    pub id: StationId,
    pub item: Option<PreparedItem>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderLine {
    pub recipe_id: RecipeId,
    pub served: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub lines: Vec<OrderLine>,
    pub reward: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: u32,
    pub name: &'static str,
    pub arrived_at_ms: u64,
    pub leaves_at_ms: u64,
    pub order: Order,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Idle,
    Running,
    Finished,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub revision: u64,
    pub now_ms: u64,
    pub phase: Phase,
    pub stations: [Station; 2],
    pub recipes: [Recipe; 2],
    pub customers: VecDeque<Customer>,
    pub coins: u32,
    pub served: u32,
    pub walked_out: u32,
}

pub enum Action {
    StartShift,
    StartCooking(StationId, RecipeId),
    ServeOrder(u32, StationId),
    DiscardItem(StationId),
}

pub struct Game {
    pub snapshot: Snapshot,
    arrivals: usize,
    next_arrival_ms: u64,
    next_customer_id: u32,
}

impl Game {
    pub fn new() -> Self {
        Self {
            snapshot: Snapshot {
                revision: 0,
                now_ms: 0,
                phase: Phase::Idle,
                stations: [
                    Station {
                        id: StationId::Grill,
                        item: None,
                    },
                    Station {
                        id: StationId::DrinkMachine,
                        item: None,
                    },
                ],
                recipes: RECIPES,
                customers: VecDeque::new(),
                coins: 0,
                served: 0,
                walked_out: 0,
            },
            arrivals: 0,
            next_arrival_ms: 0,
            next_customer_id: 1,
        }
    }

    pub fn advance_to(&mut self, now_ms: u64) {
        let state = &mut self.snapshot;
        state.now_ms = state.now_ms.max(now_ms);
        if state.phase != Phase::Running {
            return;
        }
        let before = state.customers.len();
        state
            .customers
            .retain(|customer| customer.leaves_at_ms > state.now_ms);
        state.walked_out += (before - state.customers.len()) as u32;

        if self.arrivals < SHIFT_CUSTOMERS
            && state.customers.len() < COUNTER_CAPACITY
            && state.now_ms >= self.next_arrival_ms
        {
            let items: &[RecipeId] = match self.arrivals % 3 {
                0 => &[RecipeId::Burger],
                1 => &[RecipeId::Lemonade],
                _ => &[RecipeId::Burger, RecipeId::Lemonade],
            };
            state.customers.push_back(Customer {
                id: self.next_customer_id,
                name: CUSTOMER_NAMES[self.arrivals],
                arrived_at_ms: state.now_ms,
                leaves_at_ms: state.now_ms + if items.len() == 2 { 30_000 } else { 24_000 },
                order: Order {
                    lines: items
                        .iter()
                        .map(|&recipe_id| OrderLine {
                            recipe_id,
                            served: false,
                        })
                        .collect(),
                    reward: items.iter().map(|&id| recipe(id).coins).sum(),
                },
            });
            self.arrivals += 1;
            self.next_customer_id += 1;
            self.next_arrival_ms = state.now_ms + ARRIVAL_INTERVAL_MS;
        }
        self.finish_if_empty();
    }

    pub fn apply(&mut self, action: Action) -> Result<(), &'static str> {
        if let Action::StartShift = action {
            if self.snapshot.phase == Phase::Running {
                return Err("A shift is already running.");
            }
            let now = self.snapshot.now_ms;
            self.snapshot.phase = Phase::Running;
            self.snapshot
                .stations
                .iter_mut()
                .for_each(|station| station.item = None);
            self.snapshot.customers.clear();
            self.snapshot.coins = 0;
            self.snapshot.served = 0;
            self.snapshot.walked_out = 0;
            self.arrivals = 0;
            self.next_arrival_ms = now;
            self.advance_to(now);
            return Ok(());
        }
        if self.snapshot.phase != Phase::Running {
            return Err("Start a shift first.");
        }
        match action {
            Action::StartCooking(station_id, recipe_id) => self.cook(station_id, recipe_id),
            Action::ServeOrder(customer_id, station_id) => self.serve(customer_id, station_id),
            Action::DiscardItem(station_id) => {
                let item = &mut self.snapshot.stations[station_index(station_id)].item;
                item.take().ok_or("This station is empty.")?;
                Ok(())
            }
            Action::StartShift => unreachable!(),
        }
    }

    fn cook(&mut self, station_id: StationId, recipe_id: RecipeId) -> Result<(), &'static str> {
        let recipe = recipe(recipe_id);
        let station = &mut self.snapshot.stations[station_index(station_id)];
        if station.id != recipe.station_id {
            return Err("This recipe needs a different station.");
        }
        if station.item.is_some() {
            return Err("Serve or discard the current item first.");
        }
        station.item = Some(PreparedItem {
            recipe_id,
            started_at_ms: self.snapshot.now_ms,
            ready_at_ms: self.snapshot.now_ms + recipe.cook_ms,
        });
        Ok(())
    }

    fn serve(&mut self, customer_id: u32, station_id: StationId) -> Result<(), &'static str> {
        let state = &mut self.snapshot;
        let station = &mut state.stations[station_index(station_id)];
        let item = station.item.ok_or("There is no item to serve.")?;
        if item.ready_at_ms > state.now_ms {
            return Err("This item is still cooking.");
        }
        let index = state
            .customers
            .iter()
            .position(|customer| customer.id == customer_id)
            .ok_or("That customer has already left.")?;
        let order = &mut state.customers[index].order;
        let line = order
            .lines
            .iter_mut()
            .find(|line| line.recipe_id == item.recipe_id && !line.served)
            .ok_or("This customer is waiting for a different item.")?;

        line.served = true;
        station.item = None;
        if order.lines.iter().all(|line| line.served) {
            state.coins += order.reward;
            state.served += 1;
            state.customers.remove(index);
            self.finish_if_empty();
        }
        Ok(())
    }

    fn finish_if_empty(&mut self) {
        if self.arrivals == SHIFT_CUSTOMERS && self.snapshot.customers.is_empty() {
            self.snapshot.phase = Phase::Finished;
            self.snapshot
                .stations
                .iter_mut()
                .for_each(|station| station.item = None);
        }
    }
}

fn recipe(id: RecipeId) -> &'static Recipe {
    match id {
        RecipeId::Burger => &RECIPES[0],
        RecipeId::Lemonade => &RECIPES[1],
    }
}

fn station_index(id: StationId) -> usize {
    match id {
        StationId::Grill => 0,
        StationId::DrinkMachine => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_cooking_and_pays_once_when_the_order_is_complete() {
        let mut game = Game::new();
        game.apply(Action::StartShift).unwrap();
        let customer = game.snapshot.customers[0].id;
        assert!(game
            .apply(Action::StartCooking(StationId::Grill, RecipeId::Lemonade))
            .is_err());
        game.apply(Action::StartCooking(StationId::Grill, RecipeId::Burger))
            .unwrap();
        assert!(game
            .apply(Action::ServeOrder(customer, StationId::Grill))
            .is_err());
        game.advance_to(3_500);
        game.apply(Action::ServeOrder(customer, StationId::Grill))
            .unwrap();
        assert!(game
            .apply(Action::ServeOrder(customer, StationId::Grill))
            .is_err());
        assert_eq!(game.snapshot.coins, 12);
        assert_eq!(game.snapshot.served, 1);
    }

    #[test]
    fn combo_order_keeps_partial_progress_without_paying_early() {
        let mut game = Game::new();
        game.apply(Action::StartShift).unwrap();
        game.advance_to(5_000);
        game.advance_to(10_000);
        let combo = game.snapshot.customers[2].id;
        game.apply(Action::StartCooking(
            StationId::DrinkMachine,
            RecipeId::Lemonade,
        ))
        .unwrap();
        game.apply(Action::StartCooking(StationId::Grill, RecipeId::Burger))
            .unwrap();
        game.advance_to(11_500);
        game.apply(Action::ServeOrder(combo, StationId::DrinkMachine))
            .unwrap();
        assert_eq!(game.snapshot.coins, 0);
        assert_eq!(
            game.snapshot.customers[2]
                .order
                .lines
                .iter()
                .filter(|line| line.served)
                .count(),
            1
        );
        game.advance_to(13_500);
        game.apply(Action::ServeOrder(combo, StationId::Grill))
            .unwrap();
        assert_eq!(game.snapshot.coins, 18);
    }

    #[test]
    fn caps_the_queue_and_ends_the_shift_after_walkouts() {
        let mut game = Game::new();
        game.apply(Action::StartShift).unwrap();
        for second in 1..=100 {
            game.advance_to(second * 1_000);
            assert!(game.snapshot.customers.len() <= COUNTER_CAPACITY);
        }
        assert_eq!(game.snapshot.walked_out, SHIFT_CUSTOMERS as u32);
        assert_eq!(game.snapshot.phase, Phase::Finished);
        assert_eq!(game.snapshot.coins, 0);
    }
}
