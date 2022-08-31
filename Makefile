ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.Phony: start
start:
	deno run -A main.ts --source "ripienaar/free-for-dev"


.Phony: fetch
fetch:
	deno run -A main.ts --stage fetch --source "ripienaar/free-for-dev"

.Phony: fetchsource
fetchsource:
	deno run -A main.ts --stage fetch --source ${source}


.Phony: buildmarkdown
buildmarkdown:
	deno run -A main.ts --stage buildmarkdown --source "ripienaar/free-for-dev"

# check is folder exists


.Phony: initdb
initdb:
	[[ ! -d /db/meta.json ]] && mkdir -p ./db && echo '{"sources":{}}' > ./db/meta.json

.Phony: prod-initdb
prod-initdb:
	[[ ! -d /prod-db/meta.json ]] && mkdir -p ./prod-db && echo '{"sources":{}}' > ./prod-db/meta.json
