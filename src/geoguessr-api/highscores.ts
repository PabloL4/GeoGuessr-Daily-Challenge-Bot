import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import { ChallengeHighscores, ChallengeToken } from '../types.js';
import { playGame } from './challenge.js';
import { createRequestOptions } from './common.js';
import { loginAndGetCookie } from './login.js';
import { notifyAuthFailureIfNeeded } from './authAlert.js';

const tokenFilePath = path.resolve('challengeToken.json');

const highscoresUrl: (challengeId: string) => string = (challengeId: string) => {
    const params = new URLSearchParams({
        friends: 'false',
        limit: '100',
        minRounds: '5'
    }).toString();

    return `https://www.geoguessr.com/api/v3/results/highscores/${challengeId}?${params}`;
};

export const getHighscores = async (): Promise<ChallengeHighscores | undefined> => {
    try {
        const cookie = await loginAndGetCookie();
        const tokenData = await fs.readFile(tokenFilePath, 'utf8')
            .then(data => JSON.parse(data) as ChallengeToken);

        // play game automatically if not played yet
        //const GameToken = await playGame(tokenData); //ToDo: I disabled this, let's see if there are some side effects...

        const options = createRequestOptions('GET', cookie);
        const response = await fetch(highscoresUrl(tokenData.token), options as any);
        await notifyAuthFailureIfNeeded(response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch highscores: ${response.status} ${response.statusText}`);
        }
        console.log('Highscores fetched:', response.statusText);

        // save token and response.json() to file
        const dateStr = new Date().toISOString().split('T')[0];
        const responseJson = await response.json();
        await fs.mkdir('logs/challenge_ids', { recursive: true });
        await fs.mkdir('logs/raw_challenge_results', { recursive: true });
        await fs.writeFile(
            path.resolve(`logs/challenge_ids/${dateStr}.json`),
            tokenData.token, 'utf8');
        await fs.writeFile(
            path.resolve(`logs/raw_challenge_results/${dateStr}.json`),
            JSON.stringify(responseJson), 'utf8');

        return {
            timestamp: tokenData.timestamp,
            token: tokenData.token,
            highscores: responseJson
        } as ChallengeHighscores;
    } catch (error) {
        console.error('Error getting highscores:', error);
    }
    return undefined;
};

export const getHighscoresByToken = async (token: string, cookie?: string): Promise<any | undefined> => {
    try {
        const authCookie = cookie ?? await loginAndGetCookie();
        const options = createRequestOptions("GET", authCookie);

        const response = await fetch(highscoresUrl(token), options as any);
        await notifyAuthFailureIfNeeded(response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch highscores by token: ${response.status} ${response.statusText}`);
        }
        console.log("Highscores fetched:", response.statusText);

        const responseJson = await response.json();
        return responseJson;
    } catch (error) {
        console.error("Error getting highscores by token:", error);
    }
    return undefined;
};

