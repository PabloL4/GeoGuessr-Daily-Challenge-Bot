const createHeaders = (cookie?: string): HeadersInit => {
    const headers: HeadersInit = {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        'Content-Type': 'application/json'
    };
    if (cookie) {
        headers['Cookie'] = cookie;
    }
    return headers;
}

export const createRequestOptions = <T>(method: string, cookie?: string, payload?: T): RequestInit => {
    const requestOptions: RequestInit = {
        method,
        headers: createHeaders(cookie),
    };
    if (payload) {
        requestOptions.body = JSON.stringify(payload);
    }
    return requestOptions;
};

// Total score of a highscores entry. GeoGuessr moved it from `totalScore.amount` (string)
// to `totalScoreInPoints` (number) in October 2026; both shapes are accepted.
export const getEntryScore = (entry: any): number => {
    const player = entry?.game?.player;
    return Number(player?.totalScoreInPoints ?? player?.totalScore?.amount);
};
