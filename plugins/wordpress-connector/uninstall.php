<?php
/**
 * Uninstall cleanup: remove stored settings (including the API key) when the
 * plugin is deleted.
 *
 * @package SaasConnector
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'saas_connector_settings' );
