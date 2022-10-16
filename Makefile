ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.Phony: start
start:
	deno run -A tal.ts "ripienaar/free-for-dev"
.Phony: startall
startall:
	deno run -A tal.ts


.Phony: build
build:
	deno run -A tal.ts --html --no-serve

.Phony: prod-build
prod-build:
	PROD=1 deno run -A tal.ts --push --html --no-serve
.Phony: startsource
startsource:
	deno run -A tal.ts ${source}

.Phony: all
all:
	FORCE=1 deno run -A tal.ts --html "ripienaar/free-for-dev"

.Phony: allall
allall:
	FORCE=1 deno run -A tal.ts --html
.Phony: startallforce
startallforce:
	deno run -A tal.ts --force
.Phony: fetch
fetch:
	deno run -A tal.ts --no-markdown --no-serve "ripienaar/free-for-dev" --force
.Phony: fetchall
fetchall:
	make clean && make initdb && deno run -A tal.ts --no-markdown --no-serve
.Phony: fetchsource
fetchsource:
	deno run -A tal.ts --no-markdown --no-serve ${source}




.Phony: buildmarkdown
buildmarkdown:
	FORCE=1 deno run -A tal.ts --no-fetch --no-serve "ripienaar/free-for-dev"
.Phony: buildsource
buildsource:
	FORCE=1 deno run -A tal.ts --no-serve --no-fetch ${source}
.Phony: buildmarkdownall
buildmarkdownall:
	FORCE=1 deno run -A tal.ts --no-fetch --no-serve


.Phony: serve
serve:
	deno run -A --watch=tal.ts,templates/ tal.ts --no-fetch --no-markdown


.Phony: run
run:
	FORCE=1 deno run -A --watch=tal.ts,templates/ main.ts --no-fetch


.Phony: initdb
initdb:
	[[ ! -d /db/meta.json ]] && mkdir -p ./db && cat db-meta-init.json > ./db/meta.json

.Phony: prod-initdb
prod-initdb:
	[[ ! -d /prod-db/meta.json ]] && mkdir -p ./prod-db && cat db-meta-init.json > ./prod-db/meta.json

.Phony: clean
clean:
	rm -rf ./db rm -rf ./public && make initdb

.Phony: push
push:
	cd -- ./dist/repo && git add . && git commit -m "update" && git push

.Phony: testbooks
testbooks:
	deno test -A parsers/markdownlist_test.ts --filter="#2"
.Phony: buildsite
buildsite:
	FORCE=1 deno run -A tal.ts --no-fetch --html "ripienaar/free-for-dev"
.Phony: buildsitesource
buildsitesource:
	FORCE=1 deno run -A tal.ts --no-fetch --html ${source}
.Phony: buildsiteall
buildsiteall:
	deno run -A tal.ts --no-fetch --html

.Phony: servepublic
servepublic:
	deno run -A https://deno.land/std@0.159.0/http/file_server.ts ./public -p 8000


.Phony: install
install:
	./scripts/install-mdbook.sh

.Phony: servebook
servebook:
	./bin/mdbook serve --port 8000

.Phony: buildbook
buildbook:
	./bin/mdbook build 
.Phony: publish
publish:
	wrangler pages publish public --project-name trackawesomelist


.Phony: upload
upload:
	aws s3 cp ./db  s3://trackawesomelist/db --endpoint-url $(AWS_ENDPOINT) --recursive --exclude ".*"
.Phony: prod-upload
prod-upload:
	aws s3 cp ./prod-db  s3://trackawesomelist/prod-db --endpoint-url $(AWS_ENDPOINT) --recursive --exclude ".*"
.Phony: load
load:
	aws s3 cp s3://trackawesomelist/db ./db --endpoint-url $(AWS_ENDPOINT) --recursive --exclude ".*"
.Phony: prod-load
prod-load:
	aws s3 cp s3://trackawesomelist/prod-db ./prod-db --endpoint-url $(AWS_ENDPOINT) --recursive --exclude ".*"
