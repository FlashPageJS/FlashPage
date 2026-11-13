# Django & Jinja Integration Guide

Flash Page integrates smoothly with **Django** and **Jinja2** templates to deliver instant page transitions across server-rendered Python web applications.

---

## 1. Quick Integration in Django Templates

The simplest integration involves loading `flashpage.min.js` via Django's static files system.

### Step 1: Copy Assets
Place `flashpage.min.js` inside your app's static directory:
```text
my_django_project/
└── static/
    └── js/
        └── flashpage.min.js
```

### Step 2: Include in `templates/base.html`
```html
{% load static %}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}My Django App{% endblock %}</title>
</head>
<body>
    <header>
        <nav>
            <a href="{% url 'home' %}">Home</a>
            <a href="{% url 'articles' %}">Articles</a>
            <a href="{% url 'about' %}">About</a>
        </nav>
    </header>

    <main>
        {% block content %}{% endblock %}
    </main>

    <!-- Flash Page Script with Dataset Attributes -->
    <script 
        type="module" 
        src="{% static 'js/flashpage.min.js' %}"
        data-flash-intensity="65"
        data-flash-specrules="prerender"
        data-flash-cart-safeguards
        data-flash-priority-queue
    ></script>
</body>
</html>
```

---

## 2. Option B: Custom Django Template Tag

For cleaner configuration across multiple template layouts, create a reusable template tag:

### `my_app/templatetags/flash_page.py`:
```python
from django import template
from django.utils.safestring import mark_safe
from django.templatetags.static import static
import json

register = template.Library()

@register.simple_tag
def flash_page_init(intensity=65, specrules='prerender', cart_safeguards=True):
    config = {
        'intensity': intensity,
        'specrules': specrules,
        'cartSafeguards': cart_safeguards,
        'filter': None,
    }
    
    script_url = static('js/flashpage.min.js')
    html = f"""
    <script type="module" src="{script_url}"></script>
    <script>window.flashPageConfig = {json.dumps(config)};</script>
    """
    return mark_safe(html)
```

### Usage in Jinja / Django Templates:
```html
{% load flash_page %}

<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
</head>
<body>
    <!-- Template Content -->
    {% flash_page_init intensity=65 specrules="prerender" %}
</body>
</html>
```

---

## 3. Django Route Safeguards & Best Practices

1. **Django Admin Isolation**: Flash Page automatically ignores links pointing to `/admin/` and `/admin/*` when configured with a custom filter or when running in default mode.
2. **Authentication & Logout Routes**: Always protect your logout and password reset endpoints by attaching `data-no-flash`:
   ```html
   <a href="{% url 'account_logout' %}" data-no-flash>Sign Out</a>
   ```
3. **Wagtail CMS**: If using Wagtail, Flash Page seamlessly pre-warms live preview and published Wagtail page trees without interfering with the Wagtail user bar.
4. **CSRF Protection**: Speculative requests issue standard GET requests and do not interfere with Django's `csrftoken` cookies.
