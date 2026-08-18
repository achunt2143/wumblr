import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Heading from '@enact/sandstone/Heading';
import Icon from '@enact/sandstone/Icon';
import InputField from '@enact/sandstone/Input';
import Item from '@enact/sandstone/Item';
import Popup from '@enact/sandstone/Popup';
import PropTypes from 'prop-types';
import {useCallback, useEffect, useRef, useState} from 'react';

import css from './AuthComponent.module.less';
import {$L} from '../utils/i18n';
import * as logger from '../utils/logger';

// A companion server (outside this repo) exchanges a short-lived code,
// obtained by the user from the Tumblr OAuth1 web flow, for an access
// token/secret pair. This keeps the Tumblr consumer secret usable for the
// 3-legged handshake without a full embedded browser/WebView on the TV.
const CODE_ENDPOINT = 'http://localhost:8080/wumblr/heresTheCode';

const AuthComponent = ({onAuthenticate}) => {
	const [popupVisible, setPopupVisible] = useState(false);
	const [code, setCode] = useState('');
	const [isVerifying, setIsVerifying] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const mounted = useRef(true);

	useEffect(() => () => {
		mounted.current = false;
	}, []);

	const handleLogin = useCallback(() => {
		setErrorMessage('');
		setCode('');
		setPopupVisible(true);
	}, []);

	const handlePopupClose = useCallback(() => {
		if (isVerifying) return;
		setPopupVisible(false);
		setErrorMessage('');
	}, [isVerifying]);

	const handleCodeChange = useCallback((ev) => setCode(ev.value), []);

	const handleVerifyCode = useCallback(async () => {
		setIsVerifying(true);
		setErrorMessage('');
		try {
			const response = await fetch(`${CODE_ENDPOINT}?code=${encodeURIComponent(code)}`);
			if (!response.ok) {
				throw new Error(response.status === 404 ? $L('Code is invalid') : $L('Something went wrong verifying that code'));
			}
			const data = await response.json();
			await onAuthenticate(data.accessToken, data.tokenSecret);
			if (mounted.current) setPopupVisible(false);
		} catch (err) {
			// Only errors thrown above have a message meant for display;
			// anything else (network failure, bad JSON, a rejected
			// onAuthenticate) gets a generic message instead of leaking
			// something like "Unexpected token '<'...is not valid JSON".
			const friendlyMessage = err instanceof Error && err.constructor === Error ?
				err.message :
				$L('Could not reach the login server. Please try again.');
			logger.warn('AuthComponent: verification failed', err);
			if (mounted.current) setErrorMessage(friendlyMessage);
		} finally {
			if (mounted.current) setIsVerifying(false);
		}
	}, [code, onAuthenticate]);

	return (
		<div className={css.container}>
			<Heading size="large">{$L('Login to wumblr')}</Heading>
			<BodyText size="large">
				{$L('Please navigate to website to get your 7 digit code.')}
			</BodyText>
			<Button onClick={handleLogin}>{$L('Login with code')}</Button>

			<Popup aria-label="Verify Code" open={popupVisible} onClose={handlePopupClose}>
				<div className={css.popupContent}>
					<InputField
						className={css.input}
						disabled={isVerifying}
						placeholder={$L('Enter 7-digit code')}
						size="large"
						type="text"
						value={code}
						onChange={handleCodeChange}
					/>
					<Button
						className={css.verifyButton}
						disabled={isVerifying || code.length === 0}
						onClick={handleVerifyCode}
					>
						{isVerifying ? $L('Verifying…') : $L('Verify Code')}
					</Button>
					{errorMessage ? (
						<Item slotBefore={<Icon>exclamation</Icon>}>
							{errorMessage}
						</Item>
					) : null}
				</div>
			</Popup>
		</div>
	);
};

AuthComponent.propTypes = {
	onAuthenticate: PropTypes.func.isRequired
};

export default AuthComponent;
