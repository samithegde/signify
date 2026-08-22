from collections import deque
from math import dist

import cv2
import mediapipe as mp
import numpy as np


WINDOW_SIZE = 30
MAX_HANDS = 2
LANDMARKS_PER_HAND = 21
VALUES_PER_LANDMARK = 3
FEATURE_SIZE = MAX_HANDS * LANDMARKS_PER_HAND * VALUES_PER_LANDMARK


def landmark_points(hand_landmarks) -> list[tuple[float, float, float]]:
    return [
        (landmark.x, landmark.y, landmark.z)
        for landmark in hand_landmarks.landmark
    ]


def palm_scale(points: list[tuple[float, float, float]]) -> float:
    return max(0.001, dist(points[0], points[9]))


def is_finger_extended(
    points: list[tuple[float, float, float]],
    tip: int,
    pip: int,
    mcp: int,
) -> bool:
    scale = palm_scale(points)
    wrist = points[0]
    tip_from_wrist = dist(points[tip], wrist)
    pip_from_wrist = dist(points[pip], wrist)
    tip_from_mcp = dist(points[tip], points[mcp])
    pip_from_mcp = dist(points[pip], points[mcp])

    return (
        tip_from_wrist > pip_from_wrist + scale * 0.12
        and tip_from_mcp > pip_from_mcp + scale * 0.08
        and points[tip][1] < points[pip][1] + scale * 0.08
    )


def is_thumb_extended(points: list[tuple[float, float, float]]) -> bool:
    scale = palm_scale(points)
    wrist = points[0]
    index_base = points[5]
    thumb_ip = points[3]
    thumb_tip = points[4]
    palm_direction = np.sign(index_base[0] - wrist[0]) or 1

    return (
        np.sign(thumb_tip[0] - index_base[0]) == palm_direction
        and abs(thumb_tip[0] - index_base[0]) > scale * 0.28
        and dist(thumb_tip, index_base) > dist(thumb_ip, index_base) + scale * 0.08
    )


def classify_hand_shape(points: list[tuple[float, float, float]]) -> str:
    scale = palm_scale(points)
    index = is_finger_extended(points, 8, 6, 5)
    middle = is_finger_extended(points, 12, 10, 9)
    ring = is_finger_extended(points, 16, 14, 13)
    pinky = is_finger_extended(points, 20, 18, 17)
    thumb = is_thumb_extended(points)
    extended_fingers = sum([index, middle, ring, pinky])
    folded_fingers = sum(not finger for finger in [middle, ring, pinky])
    index_dominates = dist(points[8], points[0]) > (
        max(dist(points[12], points[0]), dist(points[16], points[0])) + scale * 0.08
    )
    fingers_spread = abs(points[8][0] - points[20][0]) > scale * 0.55

    if not thumb and not index and not middle and not ring and not pinky:
        return "fist"
    if thumb and pinky and not index and not middle and not ring:
        return "y"
    if not thumb and index and middle and not ring and not pinky:
        return "peace"
    if thumb and index and (folded_fingers >= 2 or index_dominates):
        return "look"
    if not thumb and not index and not middle and not ring and pinky:
        return "I"
    if not thumb and index and not middle and not ring and not pinky:
        return "you"
    if extended_fingers == 4 and (thumb or fingers_spread):
        return "hello"

    return "..."


def predict_sign(buffer: np.ndarray) -> str:
    if buffer.shape[0] < WINDOW_SIZE:
        return "..."
    return "SIGN"


def extract_keypoints(results) -> np.ndarray:
    keypoints = np.zeros(
        (MAX_HANDS, LANDMARKS_PER_HAND, VALUES_PER_LANDMARK),
        dtype=np.float32,
    )

    if not results.multi_hand_landmarks:
        return keypoints.reshape(FEATURE_SIZE)

    hands = sorted(
        results.multi_hand_landmarks[:MAX_HANDS],
        key=lambda hand: hand.landmark[0].x,
    )

    for hand_index, hand in enumerate(hands):
        points = np.array(
            [[landmark.x, landmark.y, landmark.z] for landmark in hand.landmark],
            dtype=np.float32,
        )
        points -= points[0]
        keypoints[hand_index] = points

    return keypoints.reshape(FEATURE_SIZE)


def main() -> None:
    mp_hands = mp.solutions.hands
    frame_buffer = deque(maxlen=WINDOW_SIZE)

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(0)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 60)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    with mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=MAX_HANDS,
        model_complexity=0,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as hands:
        while cap.isOpened():
            ok, frame = cap.read()
            if not ok:
                break

            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False

            results = hands.process(rgb)
            frame_buffer.append(extract_keypoints(results))

            prediction = predict_sign(np.asarray(frame_buffer, dtype=np.float32))
            if results.multi_hand_landmarks:
                prediction = classify_hand_shape(landmark_points(results.multi_hand_landmarks[0]))

            cv2.putText(
                frame,
                prediction,
                (20, 52),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.25,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow("Sign Keypoints", frame)
            if cv2.waitKey(1) & 0xFF in (27, ord("q")):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
