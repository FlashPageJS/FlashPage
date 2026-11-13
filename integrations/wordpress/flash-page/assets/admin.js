/**
 * Flash Page Admin JavaScript
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        var intensitySelect = $('#flash_page_intensity');
        var customDelayRow = $('input[name="flash_page_settings[delay_on_hover]"]').closest('tr');

        function updateDelayVisibility() {
            var val = intensitySelect.val();
            if (val === '65' || !isNaN(parseInt(val, 10))) {
                customDelayRow.show();
            } else {
                customDelayRow.hide();
            }
        }

        if (intensitySelect.length && customDelayRow.length) {
            intensitySelect.on('change', updateDelayVisibility);
            updateDelayVisibility();
        }
    });
})(jQuery);
