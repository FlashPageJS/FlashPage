<?php
/**
 * Flash Page WooCommerce Integration Handler
 */

if (!defined('ABSPATH')) {
    exit;
}

class Flash_Page_WooCommerce {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_filter('woocommerce_loop_add_to_cart_link', array($this, 'filter_loop_add_to_cart_link'), 10, 3);
        add_action('woocommerce_after_add_to_cart_button', array($this, 'inject_single_product_safeguards'));
        add_filter('woocommerce_cart_item_remove_link', array($this, 'filter_cart_item_remove_link'), 10, 2);
    }

    /**
     * Automatically attaches data-no-flash to loop add-to-cart links
     */
    public function filter_loop_add_to_cart_link($html, $product, $args = array()) {
        $options = Flash_Page_Plugin::get_instance()->get_options();
        if (empty($options['cart_safeguards']) || empty($options['woo_loop_guard'])) {
            return $html;
        }

        if (strpos($html, 'data-no-flash') === false) {
            $html = preg_replace('/<a\b/i', '<a data-no-flash', $html, 1);
        }
        return $html;
    }

    /**
     * Attaches data-no-flash to single product add-to-cart forms
     */
    public function inject_single_product_safeguards() {
        $options = Flash_Page_Plugin::get_instance()->get_options();
        if (empty($options['cart_safeguards'])) {
            return;
        }
        echo '<input type="hidden" name="flash-page-safeguard" value="active" data-no-flash />';
    }

    /**
     * Attaches data-no-flash to cart item remove links in mini-cart and cart
     */
    public function filter_cart_item_remove_link($html, $cart_item_key) {
        $options = Flash_Page_Plugin::get_instance()->get_options();
        if (empty($options['cart_safeguards']) || empty($options['woo_mini_cart_guard'])) {
            return $html;
        }

        if (strpos($html, 'data-no-flash') === false) {
            $html = preg_replace('/<a\b/i', '<a data-no-flash', $html, 1);
        }
        return $html;
    }

    /**
     * Helper to return WooCommerce diagnostic data for admin settings
     */
    public static function get_diagnostics() {
        $is_active = class_exists('WooCommerce');
        $data = array(
            'active' => $is_active,
            'version' => $is_active && defined('WC_VERSION') ? WC_VERSION : null,
            'cart_page' => $is_active && function_exists('wc_get_page_id') ? get_permalink(wc_get_page_id('cart')) : null,
            'checkout_page' => $is_active && function_exists('wc_get_page_id') ? get_permalink(wc_get_page_id('checkout')) : null,
            'account_page' => $is_active && function_exists('wc_get_page_id') ? get_permalink(wc_get_page_id('myaccount')) : null,
        );
        return $data;
    }
}

Flash_Page_WooCommerce::get_instance();
