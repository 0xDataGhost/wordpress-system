<?php
/**
 * HMAC request-signing helper.
 *
 * Phase 4 foundation for authenticating traffic between the WordPress connector
 * and the SaaS. Requests the connector sends to the SaaS already carry the API
 * key as a bearer token; the signature adds tamper-evidence and replay
 * protection (via a timestamp) and is the basis for verifying SaaS -> WordPress
 * requests in later phases.
 *
 * @package SaasConnector
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Saas_Connector_Signature {

	const HEADER_SIGNATURE = 'X-Saas-Signature';
	const HEADER_TIMESTAMP = 'X-Saas-Timestamp';

	/**
	 * Compute a base64 HMAC-SHA256 signature over a canonical message.
	 *
	 * The signed message binds the timestamp to the body so a captured signature
	 * cannot be replayed with different content: "{timestamp}.{body}".
	 *
	 * @param string $timestamp Unix timestamp as a string.
	 * @param string $body      Raw request body.
	 * @param string $secret    Shared secret (the connector API key).
	 * @return string Base64-encoded signature.
	 */
	public static function sign( $timestamp, $body, $secret ) {
		$message = $timestamp . '.' . $body;
		return base64_encode( hash_hmac( 'sha256', $message, $secret, true ) );
	}

	/**
	 * Constant-time verification of a signature for a body/timestamp/secret.
	 *
	 * @param string $signature Provided signature (base64).
	 * @param string $timestamp Provided timestamp.
	 * @param string $body      Raw body.
	 * @param string $secret    Shared secret.
	 * @return bool
	 */
	public static function verify( $signature, $timestamp, $body, $secret ) {
		$expected = self::sign( $timestamp, $body, $secret );
		return hash_equals( $expected, (string) $signature );
	}

	/**
	 * Build the signature headers for an outgoing request body.
	 *
	 * @param string $body   Raw request body.
	 * @param string $secret Shared secret.
	 * @return array<string,string>
	 */
	public static function headers( $body, $secret ) {
		$timestamp = (string) time();
		return array(
			self::HEADER_TIMESTAMP => $timestamp,
			self::HEADER_SIGNATURE => self::sign( $timestamp, $body, $secret ),
		);
	}
}
