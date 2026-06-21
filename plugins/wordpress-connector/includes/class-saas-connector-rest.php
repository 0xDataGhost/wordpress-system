<?php
/**
 * REST API surface exposed by the connector.
 *
 * Phase 4 ships a single health endpoint so the SaaS can confirm the site is
 * reachable and the plugin is active. It returns only non-sensitive status —
 * never the API key or settings — and is therefore safe to expose publicly.
 * (HMAC verification via Saas_Connector_Signature is available to lock this
 * down in a later phase.)
 *
 * @package SaasConnector
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Saas_Connector_Rest {

	const NAMESPACE = 'saas/v1';

	/**
	 * Hook route registration.
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register GET /wp-json/saas/v1/health.
	 */
	public function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			'/health',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'health' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Return a non-sensitive health snapshot.
	 *
	 * @return WP_REST_Response
	 */
	public function health() {
		$data = array(
			'status'             => 'ok',
			'plugin'             => 'saas-connector',
			'pluginVersion'      => SAAS_CONNECTOR_VERSION,
			'connected'          => Saas_Connector_Settings::is_connected(),
			'storeConfigured'    => '' !== Saas_Connector_Settings::get( 'api_url' ),
			'woocommerceActive'  => class_exists( 'WooCommerce' ),
			'timestamp'          => gmdate( 'c' ),
		);

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => $data,
				'message' => '',
			),
			200
		);
	}
}
