ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.Phony: start
start:
	LIMIT=3 deno run -A tal.ts "ripienaar/free-for-dev"
.Phony: startall
startall:
	deno run -A tal.ts


.Phony: build
build:
	deno run -A tal.ts --html --no-serve

.Phony: prod-build
prod-build:
	PROD=1 deno run -A tal.ts --html --no-serve ${args} 
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
	LIMIT=50 FORCE=1 deno run -A --watch=tal.ts,templates/ tal.ts --no-fetch --html


.Phony: initdb
initdb:
	[[ ! -d /db/meta.json ]] && mkdir -p ./db && cat db-meta-init.json > ./db/meta.json && deno run -A init-db.ts

.Phony: prod-initdb
prod-initdb:
	[[ ! -d /prod-db/meta.json ]] && mkdir -p ./prod-db && cat db-meta-init.json > ./prod-db/meta.json && PROD=1 deno run -A init-db.ts

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

.Phony: prod-publish
prod-publish:
	wrangler pages publish prod-public --project-name trackawesomelist

.Phony: prod-upload
prod-upload:
	make prod-zipdb && aws s3 cp ./prod-db.zip  s3://trackawesomelist/prod-db.zip --endpoint-url $(AWS_ENDPOINT) 

.Phony: prod-load
prod-load:
	aws s3 cp s3://trackawesomelist/prod-db.zip ./prod-db.zip --endpoint-url $(AWS_ENDPOINT) && make prod-unzipdb

.Phony: prod-zipdb
prod-zipdb:
	zip -r -q prod-db.zip ./prod-db -x "*/.*"

.Phony: prod-unzipdb
prod-unzipdb:
	unzip -q prod-db.zip

.Phony: prod-clean
prod-clean:
	aws s3 rm s3://trackawesomelist/ --recursive --endpoint-url $(AWS_ENDPOINT) 
