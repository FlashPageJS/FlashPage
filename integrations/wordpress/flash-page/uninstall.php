<?php
/**
 * Flash Page Clean Uninstaller
 *
 * Fired when the plugin is uninstalled via WordPress Admin.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

if (is_multisite()) {
    $flash_page_sites = get_sites(array('fields' => 'ids'));
    foreach ($flash_page_sites as $flash_page_site_id) {
        switch_to_blog($flash_page_site_id);
        delete_option('flash_page_settings');
        delete_post_meta_by_key('_flash_page_disabled');
        restore_current_blog();
    }
} else {
    // 1. Delete plugin settings
    delete_option('flash_page_settings');

    // 2. Clean up post meta keys for all posts
    delete_post_meta_by_key('_flash_page_disabled');
}
