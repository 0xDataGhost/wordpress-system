<?php
/**
 * Digital delivery note endpoint (Phase 18).
 *
 * The SaaS calls POST /orders/{id}/digital-note (HMAC-signed, verified the same
 * way as the sync/product endpoints) when a digital order's codes are ready. The
 * connector stays thin: it adds a SAFE WooCommerce order note and records the
 * delivery status in order meta. It NEVER receives or stores raw codes — the
 * note is a "codes ready" notice only; customers obtain codes through the SaaS.
 *
 * @package SaasConnector
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Saas_Connector_Delivery {

	/**
	 * REST permission callback — verifies the SaaS HMAC signature.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return true|WP_Error
	 */
	public function authorize( WP_REST_Request $request ) {
		return Saas_Connector_Signature::authorize_rest( $request );
	}

	/**
	 * POST /orders/{id}/digital-note — add a safe delivery note + status meta.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function add_digital_note( WP_REST_Request $request ) {
		if ( ! function_exists( 'wc_get_order' ) ) {
			return new WP_Error(
				'woocommerce_inactive',
				'WooCommerce is not active.',
				array( 'status' => 503 )
			);
		}

		$order_id = (int) $request['id'];
		$order    = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error(
				'order_not_found',
				'Order not found.',
				array( 'status' => 404 )
			);
		}

		$params = $request->get_json_params();
		$params = is_array( $params ) ? $params : array();

		// Note text is provided by the SaaS and must NOT contain codes; sanitize
		// defensively regardless.
		$raw_note = isset( $params['note'] ) ? (string) $params['note'] : 'تم تجهيز الأكواد الرقمية لهذا الطلب.';
		$note     = sanitize_textarea_field( $raw_note );
		$status   = isset( $params['status'] ) ? sanitize_text_field( (string) $params['status'] ) : 'completed';

		// Private note (second arg false) — visible to staff, not emailed/customer-facing.
		$note_id = $order->add_order_note( $note, false );

		$order->update_meta_data( '_saas_digital_delivery_status', $status );
		$order->update_meta_data( '_saas_digital_delivery_completed_at', gmdate( 'c' ) );
		$order->save();

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => array(
					'orderId' => $order_id,
					'noteId'  => (int) $note_id,
					'status'  => $status,
				),
				'message' => '',
			),
			200
		);
	}
}
