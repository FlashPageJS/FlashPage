<?php
/**
 * Flash Page WordPress Admin Settings & Diagnostics
 */

if (!defined('ABSPATH')) {
    exit;
}

class Flash_Page_Admin {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_settings_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_init', array($this, 'handle_reset_defaults'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        add_action('add_meta_boxes', array($this, 'add_post_meta_box'));
        add_action('save_post', array($this, 'save_post_meta_box'));
    }

    public function add_settings_menu() {
        add_options_page(
            __('Flash Page Settings', 'flash-page'),
            __('Flash Page', 'flash-page'),
            'manage_options',
            'flash-page',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('flash_page_settings_group', 'flash_page_settings', array(
            'type' => 'array',
            'sanitize_callback' => array($this, 'sanitize_settings'),
            'default' => array(),
        ));
    }

    public function enqueue_admin_assets($hook) {
        if ('settings_page_flash-page' !== $hook) {
            return;
        }

        wp_enqueue_style(
            'flash-page-admin',
            FLASH_PAGE_PLUGIN_URL . 'assets/admin.css',
            array(),
            FLASH_PAGE_VERSION
        );

        wp_enqueue_script(
            'flash-page-admin',
            FLASH_PAGE_PLUGIN_URL . 'assets/admin.js',
            array('jquery'),
            FLASH_PAGE_VERSION,
            true
        );
    }

    /**
     * Strict Sanitization for all 28 Parameters
     */
    public function sanitize_settings($input) {
        if (!is_array($input)) {
            return array();
        }

        $output = array();

        // 1. General & Engine
        $output['edition'] = (isset($input['edition']) && $input['edition'] === 'lite') ? 'lite' : 'full';

        $allowed_intensities = array('65', 'mousedown', 'mousedown-only', 'viewport', 'viewport-all', 'intent-cone');
        if (isset($input['intensity']) && (in_array($input['intensity'], $allowed_intensities, true) || is_numeric($input['intensity']))) {
            $output['intensity'] = sanitize_text_field($input['intensity']);
        } else {
            $output['intensity'] = '65';
        }

        $output['delay_on_hover'] = isset($input['delay_on_hover']) ? max(0, min(5000, absint($input['delay_on_hover']))) : 65;

        $allowed_specrules = array('prefetch', 'prerender', 'no');
        $output['specrules'] = (isset($input['specrules']) && in_array($input['specrules'], $allowed_specrules, true)) ? $input['specrules'] : 'prefetch';

        $output['allow_query_string'] = !empty($input['allow_query_string']) ? 1 : 0;
        $output['allow_external_links'] = !empty($input['allow_external_links']) ? 1 : 0;
        $output['whitelist'] = !empty($input['whitelist']) ? 1 : 0;

        // 2. Performance, Queue & AI
        $output['priority_queue'] = !empty($input['priority_queue']) ? 1 : 0;
        $output['preconnect_cdn'] = !empty($input['preconnect_cdn']) ? 1 : 0;
        $output['subresources'] = !empty($input['subresources']) ? 1 : 0;
        $output['adaptive_concurrency'] = !empty($input['adaptive_concurrency']) ? 1 : 0;
        $output['max_concurrent'] = isset($input['max_concurrent']) ? max(1, min(6, absint($input['max_concurrent']))) : 3;
        $output['markov'] = !empty($input['markov']) ? 1 : 0;
        $output['backpressure'] = !empty($input['backpressure']) ? 1 : 0;
        $output['respect_data_saver'] = !empty($input['respect_data_saver']) ? 1 : 0;
        $output['respect_battery'] = !empty($input['respect_battery']) ? 1 : 0;
        $output['safari_fallback'] = !empty($input['safari_fallback']) ? 1 : 0;

        // 3. E-Commerce & WooCommerce
        $output['cart_safeguards'] = !empty($input['cart_safeguards']) ? 1 : 0;
        $output['woo_loop_guard'] = !empty($input['woo_loop_guard']) ? 1 : 0;
        $output['woo_mini_cart_guard'] = !empty($input['woo_mini_cart_guard']) ? 1 : 0;

        // 4. Analytics, Heatmaps & HUD
        $output['isolate_heatmaps'] = !empty($input['isolate_heatmaps']) ? 1 : 0;
        $allowed_analytics = array('none', 'ga4', 'datadog', 'sentry');
        $output['analytics'] = (isset($input['analytics']) && in_array($input['analytics'], $allowed_analytics, true)) ? $input['analytics'] : 'none';
        $output['beacon_url'] = !empty($input['beacon_url']) ? esc_url_raw($input['beacon_url']) : '';

        $allowed_hud = array('admin_only', 'everyone', 'disabled');
        $output['hud_visibility'] = (isset($input['hud_visibility']) && in_array($input['hud_visibility'], $allowed_hud, true)) ? $input['hud_visibility'] : 'admin_only';
        $output['debug'] = !empty($input['debug']) ? 1 : 0;

        // 5. Exclusions
        $output['custom_exclusions'] = isset($input['custom_exclusions']) ? sanitize_textarea_field($input['custom_exclusions']) : '';
        $output['custom_selector_exclusions'] = isset($input['custom_selector_exclusions']) ? sanitize_text_field($input['custom_selector_exclusions']) : '';

        // Excluded Post Types
        $output['excluded_post_types'] = array();
        if (!empty($input['excluded_post_types']) && is_array($input['excluded_post_types'])) {
            $post_types = get_post_types(array('public' => true), 'names');
            foreach ($input['excluded_post_types'] as $pt) {
                $clean_pt = sanitize_key($pt);
                if (in_array($clean_pt, $post_types, true)) {
                    $output['excluded_post_types'][] = $clean_pt;
                }
            }
        }

        return $output;
    }

    /**
     * Handles reset defaults action safely
     */
    public function handle_reset_defaults() {
        if (!isset($_POST['flash_page_reset_action'])) {
            return;
        }

        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized action.', 'flash-page'));
        }

        check_admin_referer('flash_page_reset_nonce_action', 'flash_page_reset_nonce');

        $defaults = Flash_Page_Plugin::get_instance()->get_default_options();
        update_option('flash_page_settings', $defaults);

        add_settings_error(
            'flash_page_messages',
            'flash_page_reset',
            __('Flash Page settings have been reset to optimal defaults.', 'flash-page'),
            'updated'
        );
    }

    /**
     * Adds meta box to public post types
     */
    public function add_post_meta_box() {
        $post_types = get_post_types(array('public' => true), 'names');
        foreach ($post_types as $pt) {
            add_meta_box(
                'flash_page_meta_box',
                __('Flash Page Settings', 'flash-page'),
                array($this, 'render_post_meta_box'),
                $pt,
                'side',
                'low'
            );
        }
    }

    public function render_post_meta_box($post) {
        wp_nonce_field('flash_page_meta_save_action', 'flash_page_meta_save_nonce');
        $is_disabled = (bool) get_post_meta($post->ID, '_flash_page_disabled', true);
        ?>
        <label>
            <input type="checkbox" name="flash_page_disabled" value="1" <?php checked($is_disabled, true); ?> />
            <?php esc_html_e('Disable speculative prefetching on this page', 'flash-page'); ?>
        </label>
        <p class="description" style="margin-top:6px;font-size:12px;">
            <?php esc_html_e('Prevents Flash Page from prefetching or prerendering when visitors browse this specific page.', 'flash-page'); ?>
        </p>
        <?php
    }

    public function save_post_meta_box($post_id) {
        if (!isset($_POST['flash_page_meta_save_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['flash_page_meta_save_nonce'])), 'flash_page_meta_save_action')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (!empty($_POST['flash_page_disabled'])) {
            update_post_meta($post_id, '_flash_page_disabled', 1);
        } else {
            delete_post_meta($post_id, '_flash_page_disabled');
        }
    }

    /**
     * Renders settings page with 6 comprehensive tabs
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $options = Flash_Page_Plugin::get_instance()->get_options();
        $active_tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'general';
        ?>
        <div class="wrap flash-page-admin-wrap">
            <h1 class="flash-page-title">
                <span class="dashicons dashicons-performance" style="font-size:32px;width:32px;height:32px;vertical-align:middle;margin-right:8px;color:#0073aa;"></span>
                <?php esc_html_e('Flash Page Enterprise Manager', 'flash-page'); ?>
                <span class="flash-page-version-badge">v<?php echo esc_html(FLASH_PAGE_VERSION); ?></span>
            </h1>
            <p class="flash-page-subtitle">
                <?php esc_html_e('Enterprise speculative prefetching, native Speculation Rules, and zero-latency page transitions.', 'flash-page'); ?>
            </p>

            <?php settings_errors(); ?>

            <nav class="nav-tab-wrapper flash-page-nav-tabs" role="tablist">
                <a href="?page=flash-page&tab=general" class="nav-tab <?php echo $active_tab === 'general' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-admin-generic"></span> <?php esc_html_e('General & Engine', 'flash-page'); ?>
                </a>
                <a href="?page=flash-page&tab=woocommerce" class="nav-tab <?php echo $active_tab === 'woocommerce' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-cart"></span> <?php esc_html_e('WooCommerce', 'flash-page'); ?>
                </a>
                <a href="?page=flash-page&tab=performance" class="nav-tab <?php echo $active_tab === 'performance' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-dashboard"></span> <?php esc_html_e('Performance & AI', 'flash-page'); ?>
                </a>
                <a href="?page=flash-page&tab=exclusions" class="nav-tab <?php echo $active_tab === 'exclusions' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-dismiss"></span> <?php esc_html_e('Exclusions & Filters', 'flash-page'); ?>
                </a>
                <a href="?page=flash-page&tab=analytics" class="nav-tab <?php echo $active_tab === 'analytics' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-chart-bar"></span> <?php esc_html_e('Analytics & HUD', 'flash-page'); ?>
                </a>
                <a href="?page=flash-page&tab=diagnostics" class="nav-tab <?php echo $active_tab === 'diagnostics' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-heart"></span> <?php esc_html_e('System Diagnostics', 'flash-page'); ?>
                </a>
            </nav>

            <form method="post" action="options.php" class="flash-page-form">
                <?php
                settings_fields('flash_page_settings_group');

                // ----------------------------------------------------
                // TAB 1: GENERAL & ENGINE
                // ----------------------------------------------------
                if ($active_tab === 'general') :
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('Speculation Engine & Preload Trigger Settings', 'flash-page'); ?></h2>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e('Distribution Edition', 'flash-page'); ?></th>
                            <td>
                                <fieldset>
                                    <label>
                                        <input type="radio" name="flash_page_settings[edition]" value="full" <?php checked($options['edition'], 'full'); ?>>
                                        <strong><?php esc_html_e('Full Edition (Recommended)', 'flash-page'); ?></strong>
                                    </label>
                                    <p class="description"><?php esc_html_e('Includes Markov AI prediction, subresource warming, and DevTools HUD.', 'flash-page'); ?></p>
                                    <br>
                                    <label>
                                        <input type="radio" name="flash_page_settings[edition]" value="lite" <?php checked($options['edition'], 'lite'); ?>>
                                        <strong><?php esc_html_e('Lite Edition', 'flash-page'); ?></strong>
                                    </label>
                                    <p class="description"><?php esc_html_e('Ultra-lightweight core prefetcher with zero UI overlay for minimal payload footprint.', 'flash-page'); ?></p>
                                </fieldset>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Preload Intensity Trigger', 'flash-page'); ?></th>
                            <td>
                                <select name="flash_page_settings[intensity]" id="flash_page_intensity">
                                    <option value="65" <?php selected($options['intensity'], '65'); ?>><?php esc_html_e('Hover 65ms (Default - Optimal speed & bandwidth)', 'flash-page'); ?></option>
                                    <option value="mousedown" <?php selected($options['intensity'], 'mousedown'); ?>><?php esc_html_e('Mousedown / Touch Tap (Conservative)', 'flash-page'); ?></option>
                                    <option value="mousedown-only" <?php selected($options['intensity'], 'mousedown-only'); ?>><?php esc_html_e('Mousedown Only (Strictly click start, zero hover)', 'flash-page'); ?></option>
                                    <option value="viewport" <?php selected($options['intensity'], 'viewport'); ?>><?php esc_html_e('Viewport (Mobile small screens under 450,000px)', 'flash-page'); ?></option>
                                    <option value="viewport-all" <?php selected($options['intensity'], 'viewport-all'); ?>><?php esc_html_e('Viewport All (Preload all visible links on screen)', 'flash-page'); ?></option>
                                    <option value="intent-cone" <?php selected($options['intensity'], 'intent-cone'); ?>><?php esc_html_e('Predictive Intent Cone (Mouse trajectory velocity vector)', 'flash-page'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Select the user interaction gesture that initiates speculative prefetching.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Custom Hover Delay (ms)', 'flash-page'); ?></th>
                            <td>
                                <input type="number" name="flash_page_settings[delay_on_hover]" value="<?php echo esc_attr($options['delay_on_hover']); ?>" min="0" max="5000" step="5" class="small-text" />
                                <span class="description"><?php esc_html_e('Milliseconds user must hover before preloading begins (default: 65ms).', 'flash-page'); ?></span>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Speculation Rules API Mode', 'flash-page'); ?></th>
                            <td>
                                <select name="flash_page_settings[specrules]">
                                    <option value="prefetch" <?php selected($options['specrules'], 'prefetch'); ?>><?php esc_html_e('Prefetch (Downloads document cache - Safe & Fast)', 'flash-page'); ?></option>
                                    <option value="prerender" <?php selected($options['specrules'], 'prerender'); ?>><?php esc_html_e('Prerender (Full background execution - 0ms instant display)', 'flash-page'); ?></option>
                                    <option value="no" <?php selected($options['specrules'], 'no'); ?>><?php esc_html_e('Disabled (Standard link rel=prefetch fallback)', 'flash-page'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Native Speculation Rules API supported in Chrome, Edge, and Opera 121+.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Link Boundary Scoping', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[allow_query_string]" value="1" <?php checked($options['allow_query_string'], 1); ?>>
                                    <?php esc_html_e('Allow Preloading URLs with Query Strings (?s=, ?filter=)', 'flash-page'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[allow_external_links]" value="1" <?php checked($options['allow_external_links'], 1); ?>>
                                    <?php esc_html_e('Allow Preloading External / Cross-Origin Links', 'flash-page'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[whitelist]" value="1" <?php checked($options['whitelist'], 1); ?>>
                                    <?php esc_html_e('Whitelist Only Mode (Only preload links marked with data-flash attribute)', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php
                // ----------------------------------------------------
                // TAB 2: WOOCOMMERCE
                // ----------------------------------------------------
                elseif ($active_tab === 'woocommerce') :
                    $wc_diag = Flash_Page_WooCommerce::get_diagnostics();
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('E-Commerce & WooCommerce Mutation Safeguards', 'flash-page'); ?></h2>
                    <p class="description">
                        <?php esc_html_e('Speculative prefetching must never trigger phantom cart items, accidental checkouts, or session desynchronization.', 'flash-page'); ?>
                    </p>

                    <div class="flash-page-status-card" style="margin-bottom:20px;padding:12px 16px;background:#f0f6fc;border-left:4px solid #0073aa;">
                        <strong><?php esc_html_e('WooCommerce Status:', 'flash-page'); ?></strong>
                        <?php if ($wc_diag['active']) : ?>
                            <span style="color:#10b981;font-weight:bold;">● <?php echo sprintf(esc_html__('Active (WooCommerce v%s)', 'flash-page'), esc_html($wc_diag['version'])); ?></span>
                        <?php else : ?>
                            <span style="color:#64748b;">○ <?php esc_html_e('Not detected (Standard WordPress mode)', 'flash-page'); ?></span>
                        <?php endif; ?>
                    </div>

                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e('Cart & Checkout Protection', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[cart_safeguards]" value="1" <?php checked($options['cart_safeguards'], 1); ?>>
                                    <strong><?php esc_html_e('Enable E-Commerce Cart & Checkout Protection', 'flash-page'); ?></strong>
                                </label>
                                <p class="description">
                                    <?php esc_html_e('Automatically excludes /cart, /checkout, /my-account, ?add-to-cart=, ?wc-ajax=, and empty-cart URLs.', 'flash-page'); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Add to Cart Button Shield', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[woo_loop_guard]" value="1" <?php checked($options['woo_loop_guard'], 1); ?>>
                                    <?php esc_html_e('Attach data-no-flash to WooCommerce catalog product buttons', 'flash-page'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[woo_mini_cart_guard]" value="1" <?php checked($options['woo_mini_cart_guard'], 1); ?>>
                                    <?php esc_html_e('Shield header mini-cart drop-down buttons and drawer links', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php
                // ----------------------------------------------------
                // TAB 3: PERFORMANCE, QUEUE & AI
                // ----------------------------------------------------
                elseif ($active_tab === 'performance') :
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('Queue Scheduling, Network & AI Prediction', 'flash-page'); ?></h2>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e('Prioritized Queue Scheduling', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[priority_queue]" value="1" <?php checked($options['priority_queue'], 1); ?>>
                                    <strong><?php esc_html_e('Enable Priority Queue Scheduling', 'flash-page'); ?></strong>
                                </label>
                                <p class="description">
                                    <?php esc_html_e('User interactions (hover, click start) immediately jump to the top of the prefetch queue ahead of idle or viewport links.', 'flash-page'); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Subresource Preconnect 2.0', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[preconnect_cdn]" value="1" <?php checked($options['preconnect_cdn'], 1); ?>>
                                    <strong><?php esc_html_e('Enable Subresource CDN Preconnect', 'flash-page'); ?></strong>
                                </label>
                                <p class="description">
                                    <?php esc_html_e('Automatically pre-resolves DNS and establishes TCP/TLS handshakes for external CDNs and Google Fonts found in preloaded HTML.', 'flash-page'); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Critical Subresource Warming', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[subresources]" value="1" <?php checked($options['subresources'], 1); ?>>
                                    <?php esc_html_e('Extract and pre-warm stylesheet and font subresources', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Adaptive Concurrency', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[adaptive_concurrency]" value="1" <?php checked($options['adaptive_concurrency'], 1); ?>>
                                    <?php esc_html_e('Dynamically scale concurrency based on Network Information API (4G/5G/Fiber vs 2G)', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Maximum Concurrent Connections', 'flash-page'); ?></th>
                            <td>
                                <input type="number" name="flash_page_settings[max_concurrent]" value="<?php echo esc_attr($options['max_concurrent']); ?>" min="1" max="6" class="small-text" />
                                <span class="description"><?php esc_html_e('Maximum parallel in-flight prefetch requests (1-6, default: 3).', 'flash-page'); ?></span>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Markov Predictive Navigation AI', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[markov]" value="1" <?php checked($options['markov'], 1); ?>>
                                    <?php esc_html_e('Enable Markov AI Trajectory (Predicts and warms high-probability destinations during idle time)', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Server Backpressure Guard', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[backpressure]" value="1" <?php checked($options['backpressure'], 1); ?>>
                                    <?php esc_html_e('Auto-suspend prefetching upon receiving HTTP 429 Too Many Requests or 503 Service Unavailable', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Device & Battery Guards', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[respect_data_saver]" value="1" <?php checked($options['respect_data_saver'], 1); ?>>
                                    <?php esc_html_e('Honor Data Saver and slow 2G connections', 'flash-page'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[respect_battery]" value="1" <?php checked($options['respect_battery'], 1); ?>>
                                    <?php esc_html_e('Suspend prefetching when battery level < 20% and discharging', 'flash-page'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[safari_fallback]" value="1" <?php checked($options['safari_fallback'], 1); ?>>
                                    <?php esc_html_e('Enable low-priority fetch cache warming on Safari / WebKit browsers', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php
                // ----------------------------------------------------
                // TAB 4: EXCLUSIONS & FILTERS
                // ----------------------------------------------------
                elseif ($active_tab === 'exclusions') :
                    $post_types = get_post_types(array('public' => true), 'objects');
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('URL, Path, and Post Type Exclusions', 'flash-page'); ?></h2>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e('Custom Path Exclusions', 'flash-page'); ?></th>
                            <td>
                                <textarea name="flash_page_settings[custom_exclusions]" rows="6" cols="50" class="large-text code"><?php echo esc_textarea($options['custom_exclusions']); ?></textarea>
                                <p class="description">
                                    <?php esc_html_e('Enter URL path patterns to exclude from preloading (one pattern per line, e.g. /private-area/).', 'flash-page'); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Custom CSS Selector Exclusions', 'flash-page'); ?></th>
                            <td>
                                <input type="text" name="flash_page_settings[custom_selector_exclusions]" value="<?php echo esc_attr($options['custom_selector_exclusions']); ?>" class="regular-text" placeholder=".no-prefetch, #user-menu a" />
                                <p class="description">
                                    <?php esc_html_e('Comma-separated CSS selectors to skip when collecting preloadable links.', 'flash-page'); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Exclude Post Types', 'flash-page'); ?></th>
                            <td>
                                <fieldset>
                                    <?php foreach ($post_types as $pt_name => $pt_obj) : ?>
                                        <label style="display:inline-block;margin-right:15px;margin-bottom:6px;">
                                            <input type="checkbox" name="flash_page_settings[excluded_post_types][]" value="<?php echo esc_attr($pt_name); ?>" <?php checked(in_array($pt_name, $options['excluded_post_types'], true)); ?> />
                                            <?php echo esc_html($pt_obj->labels->name); ?> (<code><?php echo esc_html($pt_name); ?></code>)
                                        </label>
                                    <?php endforeach; ?>
                                    <p class="description"><?php esc_html_e('Flash Page will be completely disabled on single view pages of selected post types.', 'flash-page'); ?></p>
                                </fieldset>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php
                // ----------------------------------------------------
                // TAB 5: ANALYTICS & HUD
                // ----------------------------------------------------
                elseif ($active_tab === 'analytics') :
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('Telemetry, Heatmap Isolation & DevTools HUD', 'flash-page'); ?></h2>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e('Heatmap & Session Replay Isolation', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[isolate_heatmaps]" value="1" <?php checked($options['isolate_heatmaps'], 1); ?>>
                                    <strong><?php esc_html_e('Isolate Hotjar, Microsoft Clarity, and FullStory during background prerender', 'flash-page'); ?></strong>
                                </label>
                                <p class="description"><?php esc_html_e('Pauses session recordings while pages are prerendered in the background to prevent phantom sessions.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Analytics Exporter', 'flash-page'); ?></th>
                            <td>
                                <select name="flash_page_settings[analytics]">
                                    <option value="none" <?php selected($options['analytics'], 'none'); ?>><?php esc_html_e('None / Custom Callback', 'flash-page'); ?></option>
                                    <option value="ga4" <?php selected($options['analytics'], 'ga4'); ?>><?php esc_html_e('Google Analytics 4 (gtag)', 'flash-page'); ?></option>
                                    <option value="datadog" <?php selected($options['analytics'], 'datadog'); ?>><?php esc_html_e('Datadog RUM (DD_RUM)', 'flash-page'); ?></option>
                                    <option value="sentry" <?php selected($options['analytics'], 'sentry'); ?>><?php esc_html_e('Sentry Breadcrumbs', 'flash-page'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Automatically dispatch navigation metrics, LCP saved timings, and prerender conversions.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Telemetry Beacon URL', 'flash-page'); ?></th>
                            <td>
                                <input type="url" name="flash_page_settings[beacon_url]" value="<?php echo esc_url($options['beacon_url']); ?>" class="regular-text" placeholder="https://example.com/api/telemetry" />
                                <p class="description"><?php esc_html_e('Optional endpoint to receive visitor navigation metrics and LCP transfer timings via navigator.sendBeacon.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('In-Browser DevTools HUD', 'flash-page'); ?></th>
                            <td>
                                <select name="flash_page_settings[hud_visibility]">
                                    <option value="admin_only" <?php selected($options['hud_visibility'], 'admin_only'); ?>><?php esc_html_e('Show for Logged-In Administrators Only (Recommended)', 'flash-page'); ?></option>
                                    <option value="everyone" <?php selected($options['hud_visibility'], 'everyone'); ?>><?php esc_html_e('Show for All Visitors (Development / Staging)', 'flash-page'); ?></option>
                                    <option value="disabled" <?php selected($options['hud_visibility'], 'disabled'); ?>><?php esc_html_e('Disabled (Never display HUD overlay)', 'flash-page'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Displays real-time queue depth, active engine, and glowing link highlights. Toggle anytime with Ctrl+Shift+F.', 'flash-page'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Console Debug Logging', 'flash-page'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="flash_page_settings[debug]" value="1" <?php checked($options['debug'], 1); ?>>
                                    <?php esc_html_e('Output detailed diagnostic logs to browser developer console', 'flash-page'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php
                // ----------------------------------------------------
                // TAB 6: SYSTEM DIAGNOSTICS
                // ----------------------------------------------------
                elseif ($active_tab === 'diagnostics') :
                    $wc_diag = Flash_Page_WooCommerce::get_diagnostics();
                    $is_ssl = is_ssl();
                    $cache_plugins = array();
                    if (defined('WPR_VERSION')) $cache_plugins[] = 'WP Rocket (' . WPR_VERSION . ')';
                    if (defined('LSCWP_V')) $cache_plugins[] = 'LiteSpeed Cache (' . LSCWP_V . ')';
                    if (defined('W3TC')) $cache_plugins[] = 'W3 Total Cache';
                    if (defined('WPCACHEHOME')) $cache_plugins[] = 'WP Super Cache';
                    if (class_exists('Autoptimize')) $cache_plugins[] = 'Autoptimize';
                ?>
                <div class="flash-page-tab-content">
                    <h2><?php esc_html_e('System Environment Diagnostics', 'flash-page'); ?></h2>
                    <table class="widefat striped" style="margin-top:15px;max-width:800px;">
                        <tbody>
                            <tr>
                                <td style="width:250px;"><strong><?php esc_html_e('Flash Page Version', 'flash-page'); ?></strong></td>
                                <td>v<?php echo esc_html(FLASH_PAGE_VERSION); ?></td>
                            </tr>
                            <tr>
                                <td><strong><?php esc_html_e('WordPress Version', 'flash-page'); ?></strong></td>
                                <td><?php echo esc_html(get_bloginfo('version')); ?></td>
                            </tr>
                            <tr>
                                <td><strong><?php esc_html_e('PHP Version', 'flash-page'); ?></strong></td>
                                <td><?php echo esc_html(PHP_VERSION); ?></td>
                            </tr>
                            <tr>
                                <td><strong><?php esc_html_e('HTTPS / SSL Status', 'flash-page'); ?></strong></td>
                                <td>
                                    <?php if ($is_ssl) : ?>
                                        <span style="color:#10b981;font-weight:bold;">✔ <?php esc_html_e('Enabled (Speculation Rules fully supported)', 'flash-page'); ?></span>
                                    <?php else : ?>
                                        <span style="color:#ef4444;font-weight:bold;">✖ <?php esc_html_e('HTTP Insecure (Speculation Rules require HTTPS)', 'flash-page'); ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <tr>
                                <td><strong><?php esc_html_e('WooCommerce Integration', 'flash-page'); ?></strong></td>
                                <td>
                                    <?php if ($wc_diag['active']) : ?>
                                        <span style="color:#10b981;font-weight:bold;">✔ <?php echo sprintf(esc_html__('Active (v%s) with Cart Safeguards', 'flash-page'), esc_html($wc_diag['version'])); ?></span>
                                    <?php else : ?>
                                        <span style="color:#64748b;"><?php esc_html_e('Not active', 'flash-page'); ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <tr>
                                <td><strong><?php esc_html_e('Detected Cache / Optimization Plugins', 'flash-page'); ?></strong></td>
                                <td>
                                    <?php if (!empty($cache_plugins)) : ?>
                                        <?php echo esc_html(implode(', ', $cache_plugins)); ?>
                                        <p class="description" style="margin-top:4px;color:#10b981;">✔ <?php esc_html_e('Compatible with Flash Page caching layers.', 'flash-page'); ?></p>
                                    <?php else : ?>
                                        <span style="color:#64748b;"><?php esc_html_e('None detected', 'flash-page'); ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>

                <?php if ($active_tab !== 'diagnostics') : ?>
                    <p class="submit" style="margin-top:20px;">
                        <?php submit_button(__('Save Settings', 'flash-page'), 'primary', 'submit', false); ?>
                    </p>
                <?php endif; ?>
            </form>

            <?php if ($active_tab === 'diagnostics') : ?>
                <hr style="margin-top:30px;margin-bottom:20px;" />
                <h3><?php esc_html_e('Reset Flash Page Settings', 'flash-page'); ?></h3>
                <p><?php esc_html_e('Restore all parameters to optimal factory defaults.', 'flash-page'); ?></p>
                <form method="post" action="" onsubmit="return confirm('<?php echo esc_js(__('Are you sure you want to reset all Flash Page settings to defaults?', 'flash-page')); ?>');">
                    <?php wp_nonce_field('flash_page_reset_nonce_action', 'flash_page_reset_nonce'); ?>
                    <input type="hidden" name="flash_page_reset_action" value="1" />
                    <?php submit_button(__('Reset to Factory Defaults', 'flash-page'), 'secondary', 'reset_defaults', false); ?>
                </form>
            <?php endif; ?>
        </div>
        <?php
    }
}

Flash_Page_Admin::get_instance();
