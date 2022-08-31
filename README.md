# Track Awesome List

## How to

1. git clone repo
2. get init parsed data

```json
{
    "name": "awesome",
    "url": "github.com/sindresorhus/awesome",
    "description": "",
    "description_html": "",
    "awesome_docs": ["https://weibo.com"],
    "items": {
        "item": {
            "date_published": "2019-01-01"
        }
    }
}
```

### update

3. fetch readme, parsed it, compare with old data, if anything changed

delete all un-exist items,
