# {{{feed.title}}}

{{{feed.description}}}

{{{feed._nav_text}}}

## Table of Contents

- [Latest Updated](#latest-updated)
- [Recently Updated](#recently-updated)
- [Top 50 Repos](#top-50-repos)
- [All Tracked List](#all-tracked-list)

## Latest Updated

{{#items}}
### [{{{title}}}](/{{{_slug}}})

{{{content_text}}}

{{/items}}

## Recently Updated

{{#recentlyUpdated}}
- [{{{name}}}]({{{url}}}) - ([Source]({{{source_url}}}))
{{/recentlyUpdated}}

## Top 50 Repos

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

