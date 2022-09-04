ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.Phony: start
start:
	deno run -A main.ts --source "ripienaar/free-for-dev"
.Phony: startall
startall:
	deno run -A main.ts

.Phony: startallforce
startallforce:
	deno run -A main.ts --force
.Phony: fetch
fetch:
	deno run -A main.ts --stage fetch --source "ripienaar/free-for-dev"
.Phony: fetchall
fetchall:
	make clean && make initdb && CACHE=1 deno run -A main.ts --stage fetch 
.Phony: fetchforce
fetchforce:
	deno run -A main.ts --force --stage fetch --source "ripienaar/free-for-dev"
.Phony: fetchsource
fetchsource:
	deno run -A main.ts --stage fetch --source ${source}




.Phony: buildmarkdown
buildmarkdown:
	deno run -A main.ts --stage buildmarkdown --push 0 --source "ripienaar/free-for-dev"
.Phony: buildmarkdownall
buildmarkdownall:
	deno run -A main.ts --stage buildmarkdown --push 0


.Phony: serve
serve:
	deno run -A --watch=main.ts,templates/ main.ts --stage serve


.Phony: run
run:
	deno run -A --watch=main.ts,templates/ main.ts --stage buildmarkdown,serve --push 0

# check is folder exists


.Phony: initdb
initdb:
	[[ ! -d /db/meta.json ]] && mkdir -p ./db && echo '{"sources":{}}' > ./db/meta.json

.Phony: prod-initdb
prod-initdb:
	[[ ! -d /prod-db/meta.json ]] && mkdir -p ./prod-db && echo '{"sources":{}}' > ./prod-db/meta.json

.Phony: clean
clean:
	rm -rf ./db

.Phony: push
push:
	cd -- ./dist/repo && git add . && git commit -m "update" && git push

.Phony: testbooks
testbooks:
	deno test -A parsers/markdownlist_test.ts --filter="#2"