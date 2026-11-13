# Laravel & Livewire Integration Guide

Flash Page provides seamless acceleration for **Laravel 10/11** applications using **Blade templates**, **Vite**, and **Livewire 3**.

---

## 1. Installation via Vite & NPM

Install Flash Page in your Laravel application:

```bash
npm install flash-page
```

### Initialize in `resources/js/app.js`:
```javascript
import './bootstrap'
import { init } from 'flash-page'

// Initialize Flash Page when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init({
        intensity: 65,
        specrules: 'prerender',
        cartSafeguards: true,
        priorityQueue: true,
        filter: (url) => {
            // Exclude Laravel Nova, Horizon, Pulse, and Auth routes
            const path = url.pathname.toLowerCase()
            if (path.startsWith('/nova') || path.startsWith('/horizon') || path.startsWith('/pulse')) {
                return false
            }
            if (path.includes('/logout') || path.includes('/email/verify')) {
                return false
            }
            return true
        }
    })
})
```

---

## 2. Option B: Custom Blade Directive (`@flashPage`)

If you want to inject Flash Page cleanly via Blade directives, register a custom directive in your `AppServiceProvider`:

### `app/Providers/AppServiceProvider.php`:
```php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Blade::directive('flashPage', function ($expression) {
            $options = $expression ?: "['intensity' => 65, 'specrules' => 'prerender', 'cartSafeguards' => true]";
            return "<?php
                echo '<script type=\"module\" src=\"' . asset('js/flashpage.min.js') . '\"></script>';
                echo '<script>window.flashPageConfig = ' . json_encode({$options}) . ';</script>';
            ?>";
        });
    }
}
```

### Usage in `resources/views/layouts/app.blade.php`:
```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Laravel') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="font-sans antialiased">
    <div class="min-h-screen bg-gray-100">
        @include('layouts.navigation')

        <!-- Page Content -->
        <main>
            {{ $slot }}
        </main>
    </div>

    <!-- Optional Blade Directive -->
    @flashPage(['intensity' => 65, 'specrules' => 'prerender'])
</body>
</html>
```

---

## 3. Compatibility with Livewire 3 (`wire:navigate`)

Livewire 3 introduces single-page navigation via `wire:navigate`. Flash Page cooperates seamlessly with Livewire:

1. **Document Cache Warming**: Flash Page warms the destination document in memory.
2. **Instant Swapping**: When the user clicks a `wire:navigate` link, Livewire fetches and swaps the page payload in 0ms because the connection and document cache are already warm.

### Livewire Navigation Example:
```blade
<nav>
    <!-- Livewire SPA link with Flash Page Prerendering -->
    <a href="/dashboard" wire:navigate data-flash-specrules="prerender">
        Dashboard
    </a>

    <a href="/team" wire:navigate data-flash-priority="high">
        Team Settings
    </a>

    <!-- Sensitive mutation link: excluded from speculation -->
    <a href="{{ route('logout') }}" onclick="event.preventDefault(); document.getElementById('logout-form').submit();" data-no-flash>
        Log Out
    </a>
</nav>
```

---

## 4. Best Practices in Laravel

1. **CSRF & Form Safeguards**: Flash Page automatically ignores links containing `[data-method="post"]` or `[data-method="delete"]` used by Laravel UJS or Inertia.
2. **Encrypted Session Cookies**: Same-origin speculative requests preserve Laravel session and CSRF cookies without invalidation.
3. **Queue Prioritization**: For multi-step wizard forms or checkout sequences, elevate next-step links with `data-flash-priority="high"`.
