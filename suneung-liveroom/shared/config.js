// 이 파일은 "숫자 설정 모음"이에요. 화면(client)과 서버(server)가 똑같이 가져다 써요.
// 건물 크기·교실 수·좌석 배치 같은 값을 바꾸고 싶으면 여기만 고치면 돼요. (단위: 미터)

export const SCHOOL_NAME = '수능고등학교';
export const EXAM_DATE = '2026-11-19'; // 2027학년도 수능 시행일 (한국교육과정평가원 공고)

export const FLOORS = 3;        // 층 수
export const ROOMS = 5;         // 한 층의 교실 수
export const FLOOR_H = 3.6;     // 한 층 높이
export const CORR_W = 3.6;      // 복도 폭 (z: 0 ~ 3.6)
export const ROOM_L = 12;       // 교실 길이 (복도를 따라 x 방향)
export const ROOM_D = 10;       // 교실 깊이 (z 방향)
export const STAIR_W = 4.5;     // 양쪽 끝 계단실 폭

export const BW = STAIR_W * 2 + ROOM_L * ROOMS; // 건물 전체 가로 = 69
export const BD = CORR_W + ROOM_D;              // 건물 전체 세로 = 13.6
export const ZC = CORR_W + ROOM_D / 2;          // 교실 가운데 z = 8.6

export const COLS = 5;          // 책상 열 수 (칠판을 마주 보고 가로로)
export const ROWS = 3;          // 책상 줄 수
export const COL_DZ = 1.7;      // 열 사이 간격
export const ROW_X = [3.0, 4.7, 6.4]; // 교실 서쪽 벽(칠판)에서 각 줄 책상까지 거리
export const SEATS_PER_ROOM = COLS * ROWS; // 15

export const DOOR_X0 = 9.4;     // 교실 문 시작 (교실 서쪽 벽 기준)
export const DOOR_X1 = 10.7;    // 교실 문 끝

export const MAX_PER_SCHOOL = 80; // 한 학교(건물)에 동시에 들어올 수 있는 인원

export const roomX0 = (r) => STAIR_W + ROOM_L * r;     // r번째 교실의 서쪽 벽 x
export const floorY = (f) => (f - 1) * FLOOR_H;        // f층 바닥 높이 (f = 1, 2, 3)
