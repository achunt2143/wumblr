import {useCallback, useEffect, useState} from 'react';

import * as appCache from '../services/appCache';
import * as storage from '../services/storage';
import * as tumblrClient from '../services/tumblrClient';
import * as logger from '../utils/logger';

function useTumblrAuth () {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	// The whole profile, not just the name: Settings shows the account's
	// counts and they all arrive on this one call.
	const [profile, setProfile] = useState(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const stored = await storage.getStoredToken();
			if (cancelled) return;

			if (stored) {
				tumblrClient.configureClient(stored.token, stored.tokenSecret);
				try {
					const nextProfile = await tumblrClient.getUserInfo();
					// Caches are session state, so they are filled before the
					// feed renders - posts read their reblog state during
					// render and can't await it.
					await appCache.hydrate();
					if (!cancelled) {
						setProfile(nextProfile);
						setIsLoggedIn(true);
					}
				} catch (err) {
					logger.warn('useTumblrAuth: stored token was rejected', err);
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
		const nextProfile = await tumblrClient.getUserInfo();
		await storage.saveToken(token, tokenSecret);
		await appCache.hydrate();
		setProfile(nextProfile);
		setIsLoggedIn(true);
	}, []);

	const logout = useCallback(async () => {
		tumblrClient.resetClient();
		setIsLoggedIn(false);
		setProfile(null);
		// Caches belong to the account that was signed in, so they go too.
		await Promise.all([storage.clearStoredToken(), appCache.clear()]);
	}, []);

	return {isLoggedIn, isLoading, profile, username: (profile && profile.name) || '', login, logout};
}

export default useTumblrAuth;
