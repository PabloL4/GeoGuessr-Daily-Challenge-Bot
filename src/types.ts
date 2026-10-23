export interface MapsResponse {
    name: string;
};

export type GameMode = 'Move' | 'NM' | 'NMPZ';

export interface ChallengeSettings {
    map: string;
    mode: GameMode;
    timeLimit: number;
    roundCount: number;
}
export interface ChallengePayload {
    map: string;
    forbidMoving: boolean;
    forbidRotating: boolean;
    forbidZooming: boolean;
    timeLimit: number;
    roundCount: number;
};

export interface ChallengeSettingsForPost {
    name: string;
    mode: GameMode;
    token: string;

    timeLimit?: number;
    roundCount?: number;

    mapId?: string;
    mapUrl?: string;

    dayIndex?: number;
    timestamp?: number; // unix seconds shown in the post; defaults to now
    late?: boolean; // adds a "missed challenge" note when re-posting
}


export interface ChallengeResponse {
    token: string;
}

export interface ChallengeToken {
    timestamp: number;
    token: string;
};

interface HighscoresResponse {
    map(arg0: (entry: any, index: any) => string): unknown;
    items: [
        {
            game: {
                player: {
                    id: string;
                    nick: string;
                    countryCode?: string;
                    totalScore: { amount: string };
                };
            }
        }
    ];
};

export interface ChallengeHighscores {
    timestamp: number;
    token: string;
    highscores: HighscoresResponse;
};

export interface GameToken {
    token: string;
    state: string;
};
