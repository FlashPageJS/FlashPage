<?php
/**
 * Plugin Name: Flash Page
 * Plugin URI: https://github.com/FlashPageJS/FlashPage
 * Description: Enterprise speculative prefetching and native Speculation Rules manager for WordPress and WooCommerce.
 * Version: 1.2.0
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Flash Page Contributors
 * Author URI: https://github.com/FlashPageJS/FlashPage
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: flash-page
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('FLASH_PAGE_VERSION', '1.2.0');
define('FLASH_PAGE_PLUGIN_FILE', __FILE__);
define('FLASH_PAGE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FLASH_PAGE_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once FLASH_PAGE_PLUGIN_DIR . 'includes/class-admin.php';
require_once FLASH_PAGE_PLUGIN_DIR . 'includes/class-woocommerce.php';
require_once FLASH_PAGE_PLUGIN_DIR . 'includes/class-admin-bar.php';

/**
 * Main Flash Page Plugin Class
 */
class Flash_Page_Plugin {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', array($this, 'init_plugin'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_filter('script_loader_tag', array($this, 'filter_script_tag'), 10, 3);
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_action_links'));
    }

    public function init_plugin() {
        load_plugin_textdomain('flash-page', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }

    /**
     * Default options for all 28 Flash Page capabilities
     */
    public function get_default_options() {
        return array(
            // General
            'edition' => 'full', // 'full' or 'lite'
            'intensity' => '65', // '65', 'mousedown', 'mousedown-only', 'viewport', 'viewport-all', 'intent-cone'
            'delay_on_hover' => 65,
            'specrules' => 'prefetch', // 'prefetch', 'prerender', 'no'
            'allow_query_string' => 0,
            'allow_external_links' => 0,
            'whitelist' => 0,

            // Performance & Queue
            'priority_queue' => 1,
            'preconnect_cdn' => 1,
            'subresources' => 0,
            'adaptive_concurrency' => 0,
            'max_concurrent' => 3,
            'markov' => 1,
            'backpressure' => 1,
            'respect_data_saver' => 1,
            'respect_battery' => 1,
            'safari_fallback' => 1,

            // E-Commerce & WooCommerce
            'cart_safeguards' => 1,
            'woo_loop_guard' => 1,
            'woo_mini_cart_guard' => 1,

            // Analytics & HUD
            'isolate_heatmaps' => 1,
            'analytics' => 'none', // 'none', 'ga4', 'datadog', 'sentry'
            'beacon_url' => '',
            'hud_visibility' => 'admin_only', // 'admin_only', 'everyone', 'disabled'
            'debug' => 0,

            // Exclusions
            'custom_exclusions' => "/wp-admin/\n/wp-login.php\n/feed/\n/sitemap",
            'custom_selector_exclusions' => '',
            'excluded_post_types' => array(),
        );
    }

    public function get_options() {
        $defaults = $this->get_default_options();
        $saved = get_option('flash_page_settings', array());
        return wp_parse_args($saved, $defaults);
    }

    /**
     * Determines whether Flash Page should be loaded on the current request
     */
    public function should_load() {
        // Never run in admin, AJAX, cron, REST API, CLI, or XML-RPC
        if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return false;
        }

        // Exclude feed, robots, sitemap, trackback
        if (is_feed() || is_robots() || is_trackback()) {
            return false;
        }

        $options = $this->get_options();

        // Check per-page / per-post meta box exclusion
        if (is_singular()) {
            $post_id = get_the_ID();
            if ($post_id && get_post_meta($post_id, '_flash_page_disabled', true)) {
                return false;
            }

            // Check excluded post types
            $post_type = get_post_type($post_id);
            if (!empty($options['excluded_post_types']) && is_array($options['excluded_post_types'])) {
                if (in_array($post_type, $options['excluded_post_types'], true)) {
                    return false;
                }
            }
        }

        // Check WooCommerce sensitive pages if cart safeguards active
        if (!empty($options['cart_safeguards']) && class_exists('WooCommerce')) {
            if (function_exists('is_cart') && is_cart()) return false;
            if (function_exists('is_checkout') && is_checkout()) return false;
            if (function_exists('is_account_page') && is_account_page()) return false;
            if (function_exists('is_order_received_page') && is_order_received_page()) return false;
        }

        // Custom path exclusions matching
        if (!empty($options['custom_exclusions'])) {
            $current_uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
            if (!empty($current_uri)) {
                $lines = explode("\n", str_replace("\r", "", $options['custom_exclusions']));
                foreach ($lines as $line) {
                    $pattern = trim($line);
                    if ($pattern !== '' && stripos($current_uri, $pattern) !== false) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Enqueues Flash Page script with inline configuration
     */
    public function enqueue_scripts() {
        if (!$this->should_load()) {
            return;
        }

        $options = $this->get_options();
        $is_lite = ($options['edition'] === 'lite');
        $script_file = $is_lite ? 'flashpage.lite.min.js' : 'flashpage.min.js';
        $script_url = FLASH_PAGE_PLUGIN_URL . 'assets/' . $script_file;

        wp_enqueue_script(
            'flash-page',
            $script_url,
            array(),
            FLASH_PAGE_VERSION,
            true
        );

        // Build JavaScript config object
        $js_config = array(
            'intensity' => is_numeric($options['intensity']) ? intval($options['intensity']) : $options['intensity'],
            'delayOnHover' => absint($options['delay_on_hover']),
            'specrules' => in_array($options['specrules'], array('prefetch', 'prerender', 'no'), true) ? $options['specrules'] : 'prefetch',
            'allowQueryString' => !empty($options['allow_query_string']),
            'allowExternalLinks' => !empty($options['allow_external_links']),
            'whitelist' => !empty($options['whitelist']),
            'priorityQueue' => !empty($options['priority_queue']),
            'preconnectCdn' => !empty($options['preconnect_cdn']),
            'subresources' => !empty($options['subresources']),
            'adaptiveConcurrency' => !empty($options['adaptive_concurrency']),
            'maxConcurrent' => max(1, min(6, absint($options['max_concurrent']))),
            'markov' => !empty($options['markov']),
            'backpressure' => !empty($options['backpressure']),
            'respectDataSaver' => !empty($options['respect_data_saver']),
            'respectBattery' => !empty($options['respect_battery']),
            'safariFallback' => !empty($options['safari_fallback']),
            'cartSafeguards' => !empty($options['cart_safeguards']),
            'isolateHeatmaps' => !empty($options['isolate_heatmaps']),
            'debug' => !empty($options['debug']),
        );

        if ($options['analytics'] !== 'none') {
            $js_config['analytics'] = $options['analytics'];
        }

        if (!empty($options['beacon_url'])) {
            $js_config['beaconUrl'] = esc_url_raw($options['beacon_url']);
        }

        // HUD overlay configuration
        if ($options['hud_visibility'] === 'everyone' || ($options['hud_visibility'] === 'admin_only' && current_user_can('manage_options'))) {
            $js_config['hud'] = true;
        } else {
            $js_config['hud'] = false;
        }

        // Pass config via standard WordPress inline script API
        $inline_script = 'window.flashPageConfig = ' . wp_json_encode($js_config) . ';';
        if (!empty($options['custom_selector_exclusions'])) {
            $selectors = sanitize_text_field($options['custom_selector_exclusions']);
            $inline_script .= 'document.addEventListener("DOMContentLoaded", function() { try { document.querySelectorAll(' . wp_json_encode($selectors) . ').forEach(function(el) { el.setAttribute("data-no-flash", ""); }); } catch(e){} });';
        }
        wp_add_inline_script('flash-page', $inline_script, 'before');
    }

    /**
     * Adds type="module" and data attributes to script tag
     */
    public function filter_script_tag($tag, $handle, $src) {
        if ('flash-page' !== $handle) {
            return $tag;
        }

        $options = $this->get_options();
        $attributes = array('type="module"');

        // Intensity
        if (!empty($options['intensity']) && $options['intensity'] !== '65') {
            $attributes[] = 'data-flash-intensity="' . esc_attr($options['intensity']) . '"';
        }

        // Specrules
        if (!empty($options['specrules']) && $options['specrules'] !== 'prefetch') {
            $attributes[] = 'data-flash-specrules="' . esc_attr($options['specrules']) . '"';
        }

        // Adaptive Concurrency
        if (!empty($options['adaptive_concurrency'])) {
            $attributes[] = 'data-flash-adaptive-concurrency';
        }

        // Cart safeguards
        if (empty($options['cart_safeguards'])) {
            $attributes[] = 'data-flash-no-cart-safeguards';
        }

        // Priority queue
        if (empty($options['priority_queue'])) {
            $attributes[] = 'data-flash-no-priority-queue';
        }

        // Preconnect CDN
        if (empty($options['preconnect_cdn'])) {
            $attributes[] = 'data-flash-no-preconnect-cdn';
        }

        // HUD overlay
        if ($options['hud_visibility'] === 'everyone' || ($options['hud_visibility'] === 'admin_only' && current_user_can('manage_options'))) {
            $attributes[] = 'data-flash-hud';
        }

        $attr_string = implode(' ', $attributes);
        return preg_replace('/<script\b/i', '<script ' . $attr_string, $tag, 1);
    }

    /**
     * Adds Settings link to WordPress Plugins list table
     */
    public function add_action_links($links) {
        $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=flash-page')) . '">' . esc_html__('Settings', 'flash-page') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }
}

Flash_Page_Plugin::get_instance();
