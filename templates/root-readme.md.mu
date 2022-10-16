# {{{feed.title}}}

{{{feed.description}}}

{{{feed._nav_text}}}

## Table of Contents

- [Recently Updated List](#recently-updated-list)
- [Recently Updated Items](#recently-updated-items)
- [Top 50 Awesome List](#top-50-awesome-list)
- [All Tracked List](#all-tracked-list)

## Recently Updated List

{{#recentlyUpdated}}
- [{{{name}}}]({{{url}}}) - ([Source]({{{source_url}}}))
{{/recentlyUpdated}}

## Recently Updated Items

{{#items}}
### [{{{title}}}]({{{_filepath}}})

{{{content_text}}}

{{/items}}


## Top 50 Awesome List

{{#sortedRepos}}
- [{{{name}}}]({{{url}}}) - ([Source]({{{source_url}}}))
{{/sortedRepos}}

## All Tracked List

{{#list}}
- {{category}}
{{#items}}
  - [{{{name}}}]({{{url}}})
{{/items}}
{{/list}}

