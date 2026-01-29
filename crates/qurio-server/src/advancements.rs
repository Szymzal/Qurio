use std::sync::Arc;

use qurio_protocol::structs::{
    GameAdvancements, QuickAdvancement, RatioAdvancement, StreakAdvancement, UserId,
};

use crate::{AppState, InternalGameAdvancements};

pub trait GameAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        todo!()
    }
}

pub trait QuestionAdvancement {
    fn create_from_question_state(_app_state: Arc<AppState>) -> impl Future<Output = Self> + Send
    where
        Self: Sized,
    {
        async { todo!() }
    }
}

pub trait GameGroupAdvancements {
    fn create_from_internal(internal: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        todo!()
    }
}

impl GameAdvancement for QuickAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let quick_advancement = game_advancements
            .quick
            .iter()
            .min_by(|a, b| a.1.cmp(b.1))
            .map(|(user, time)| QuickAdvancement {
                user: *user,
                time: *time,
            });

        quick_advancement.unwrap_or_else(|| {
            // Some way to indicate the none value
            QuickAdvancement {
                user: UserId::new(0), // Fabricate UserId
                time: u32::MAX,
            }
        })
    }
}

impl QuestionAdvancement for QuickAdvancement {
    async fn create_from_question_state(app_state: Arc<AppState>) -> Self
    where
        Self: Sized,
    {
        std::todo!()
    }
}

impl GameAdvancement for RatioAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let ratio_advancement = game_advancements
            .ratio
            .iter()
            .max_by(|a, b| a.1.percent().total_cmp(&b.1.percent()))
            .map(|(user, ratio)| RatioAdvancement {
                user: *user,
                ratio: (ratio.percent() * 100.0).floor() as u8,
            });

        ratio_advancement.unwrap_or_else(|| {
            RatioAdvancement {
                user: UserId::new(1), // Fabricate UserId
                ratio: 0u8,
            }
        })
    }
}

impl GameAdvancement for StreakAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let streak_advancement = game_advancements
            .streak
            .iter()
            .max_by(|a, b| a.1.cmp(b.1))
            .map(|(user, streak)| StreakAdvancement {
                user: *user,
                streak: *streak,
            });

        streak_advancement.unwrap_or_else(|| {
            StreakAdvancement {
                user: UserId::new(0), // Fabricate UserId
                streak: 0,
            }
        })
    }
}

impl QuestionAdvancement for StreakAdvancement {
    async fn create_from_question_state(_app_state: Arc<AppState>) -> Self
    where
        Self: Sized,
    {
        std::todo!()
    }
}

impl GameGroupAdvancements for GameAdvancements {
    fn create_from_internal(internal: &InternalGameAdvancements) -> Self {
        Self {
            quickest: QuickAdvancement::create_from_game_state(internal),
            streak: StreakAdvancement::create_from_game_state(internal),
            ratio: RatioAdvancement::create_from_game_state(internal),
        }
    }
}
