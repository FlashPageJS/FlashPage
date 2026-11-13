<?php
/**
 * Flash Page WP Admin Bar Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Flash_Page_Admin_Bar {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_bar_menu', array($this, 'add_admin_bar_items'), 100);
    }

    /**
     * Adds Flash Page quick menu in WordPress Admin Bar
     *
     * @param WP_Admin_Bar $wp_admin_bar
     */
    public function add_admin_bar_items($wp_admin_bar) {
        if (!current_user_can('manage_options') || is_admin()) {
            return;
        }

        $options = Flash_Page_Plugin::get_instance()->get_options();
        $edition_label = ($options['edition'] === 'lite') ? __('Lite', 'flash-page') : __('Full', 'flash-page');

        // Main Node
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-status',
            'title' => '<span class="ab-icon dashicons dashicons-performance" style="font-size:18px;margin-top:2px;"></span>' . esc_html__('Flash Page', 'flash-page'),
            'href' => esc_url(admin_url('options-general.php?page=flash-page')),
            'meta' => array(
                'title' => esc_attr__('Flash Page Speculative Prefetch Status', 'flash-page'),
            ),
        ));

        // Subnode: Edition
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-edition',
            'parent' => 'flash-page-status',
            'title' => sprintf(esc_html__('Edition: %s', 'flash-page'), esc_html($edition_label)),
            'href' => esc_url(admin_url('options-general.php?page=flash-page')),
        ));

        // Subnode: Intensity
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-intensity',
            'parent' => 'flash-page-status',
            'title' => sprintf(esc_html__('Intensity: %s', 'flash-page'), esc_html($options['intensity'])),
            'href' => esc_url(admin_url('options-general.php?page=flash-page')),
        ));

        // Subnode: Speculation Rules Mode
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-specrules',
            'parent' => 'flash-page-status',
            'title' => sprintf(esc_html__('Speculation Mode: %s', 'flash-page'), esc_html(strtoupper($options['specrules']))),
            'href' => esc_url(admin_url('options-general.php?page=flash-page')),
        ));

        // Subnode: Toggle HUD (Ctrl+Shift+F)
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-toggle-hud',
            'parent' => 'flash-page-status',
            'title' => esc_html__('Toggle In-Browser HUD (Ctrl+Shift+F)', 'flash-page'),
            'href' => '#',
            'meta' => array(
                'onclick' => 'if(window.flashPage&&window.flashPage.toggleHUD){window.flashPage.toggleHUD();}return false;',
            ),
        ));

        // Subnode: Settings Link
        $wp_admin_bar->add_node(array(
            'id' => 'flash-page-settings-link',
            'parent' => 'flash-page-status',
            'title' => esc_html__('Flash Page Settings', 'flash-page'),
            'href' => esc_url(admin_url('options-general.php?page=flash-page')),
        ));
    }
}

Flash_Page_Admin_Bar::get_instance();
