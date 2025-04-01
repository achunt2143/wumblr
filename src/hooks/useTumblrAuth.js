import {useCallback, useEffect, useState} from 'react';

import * as storage from '../services/storage';
import * as tumblrClient from '../services/tumblrClient';

function useTumblrAuth() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [username, setUsername] = useState('');

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const stored = await storage.getStoredToken();
			if (cancelled) return;

			if (stored) {
				tumblrClient.configureClient(stored.token, stored.tokenSecret);
				try {
					const user = await tumblrClient.getUserInfo();
					if (!cancelled) {
						setUsername(user.name);
						setIsLoggedIn(true);
					}
				} catch (err) {
					console.warn('useTumblrAuth: stored token was rejected', err);
					tumblrClient.resetClient();
				}
			}

			if (!cancelled) setIsLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const login = useCallback(async (token, tokenSecret) => {
		tumblrClient.configureClient(token, tokenSecret);
		const user = await tumblrClient.getUserInfo();
		await storage.saveToken(token, tokenSecret);
		setUsername(user.name);
		setIsLoggedIn(true);
	}, []);

	const logout = useCallback(async () => {
		tumblrClient.resetClient();
		setIsLoggedIn(false);
		setUsername('');
		await storage.clearStoredToken();
	}, []);

	return {isLoggedIn, isLoading, username, login, logout};
}

export default useTumblrAuth;
