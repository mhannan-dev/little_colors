//! The handling model uses SI units and is independent of Bevy and Rapier.

const WHEELBASE_M: f32 = 2.7;
const MAX_FORWARD_MPS: f32 = 43.0;
const MAX_REVERSE_MPS: f32 = 8.0;

#[derive(Default)]
pub struct DriverControls {
    pub throttle: bool,
    pub brake: bool,
    pub steer: f32,
}

pub fn longitudinal_accel(input: &DriverControls, speed: f32, dt: f32) -> f32 {
    let drive = if input.brake && speed > 0.6 {
        -17.0_f32.min(speed / dt)
    } else if input.brake {
        -5.0 * (1.0 + speed / MAX_REVERSE_MPS).clamp(0.0, 1.0)
    } else if input.throttle {
        13.5 * (1.0 - speed / MAX_FORWARD_MPS).clamp(0.0, 1.0)
    } else {
        0.0
    };
    drive - speed * (0.035 + 0.006 * speed.abs())
}

pub fn lateral_accel(lateral_speed: f32) -> f32 {
    (-lateral_speed * 8.0).clamp(-20.0, 20.0)
}

pub fn desired_yaw_rate(steer: f32, speed: f32) -> f32 {
    // Bicycle approximation with speed-sensitive steering and a yaw-rate limit.
    let wheel_angle = steer * 0.38 / (1.0 + speed.abs() * 0.025);
    (-speed * wheel_angle.tan() / WHEELBASE_M).clamp(-1.7, 1.7)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn throttle_accelerates_and_brake_opposes_forward_motion() {
        let throttle = DriverControls {
            throttle: true,
            ..DriverControls::default()
        };
        let brake = DriverControls {
            brake: true,
            ..DriverControls::default()
        };
        assert!(longitudinal_accel(&throttle, 0.0, 1.0 / 60.0) > 0.0);
        assert!(longitudinal_accel(&throttle, MAX_FORWARD_MPS, 1.0 / 60.0) < 0.0);
        assert!(longitudinal_accel(&brake, 16.0, 1.0 / 60.0) < 0.0);
    }

    #[test]
    fn reversing_changes_steering_sign_and_stopped_cars_do_not_turn() {
        assert!(desired_yaw_rate(1.0, 12.0) < 0.0);
        assert!(desired_yaw_rate(1.0, -4.0) > 0.0);
        assert_eq!(desired_yaw_rate(1.0, 0.0), 0.0);
    }

    #[test]
    fn lateral_grip_opposes_slide_and_caps_the_correction() {
        assert_eq!(lateral_accel(1.0), -8.0);
        assert_eq!(lateral_accel(-1.0), 8.0);
        assert_eq!(lateral_accel(9.0), -20.0);
    }
}
