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

.Phony: prod-start
prod-start:
	FORCE=1 PROD=1 deno run -A tal.ts ${args} 

.Phony: prod-build
prod-build:
	PROD=1 deno run -A tal.ts --html --no-serve ${args} && make prod-buildsearch 

.Phony: prod-run
prod-run:
	FORCE=1 PROD=1 deno run -A tal.ts --html ${args} 

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
	deno run -A tal.ts --no-markdown --no-serve
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
	LIMIT=3 FORCE=1 deno run -A tal.ts --no-fetch --html

.Phony: siteall
siteall:
	FORCE=1 deno run -A tal.ts --no-fetch --html
.Phony: initdb
initdb:
	[[ ! -d /db/meta.json ]] && mkdir -p ./db && cat db-meta-init.json > ./db/meta.json && deno run -A init-db.ts

.Phony: prod-initdb
prod-initdb:
	[[ ! -d /prod-db/meta.json ]] && mkdir -p ./prod-db && cat db-meta-init.json > ./prod-db/meta.json && PROD=1 deno run -A init-db.ts

.Phony: clean
clean:
	rm -rf ./db rm -rf ./public && rm -rf ./dist && rm -rf ./prod-db && rm -rf ./prod-dist && rm -rf ./prod-public && make initdb && make prod-initdb

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
	FORCE=1 deno run -A tal.ts --no-fetch --html

.Phony: prod-buildsiteall
prod-buildsiteall:
	PROD=1 FORCE=1 deno run -A tal.ts --no-fetch --html --no-serve
.Phony: buildhtmlall
buildhtmlall:
	deno run -A tal.ts --no-fetch --no-markdown --html --no-serve

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
	wrangler pages publish db/public --project-name trackawesomelist

.Phony: prod-publish
prod-publish:
	wrangler pages publish prod-db/public --project-name trackawesomelist

.Phony: prod-upload
prod-upload:
	make prod-zipdb && aws s3 cp ./prod-db.zip  s3://trackawesomelist/prod-db.zip --endpoint-url $(AWS_ENDPOINT) 

.Phony: prod-load
prod-load:
	aws s3 cp s3://trackawesomelist/prod-db.zip ./prod-db.zip --endpoint-url $(AWS_ENDPOINT) && make prod-unzipdb

.Phony: prod-zipdb
prod-zipdb:
	zip -r -q -FS prod-db.zip ./prod-db -x "*/.*"

.Phony: prod-unzipdb
prod-unzipdb:
	unzip -q -o prod-db.zip

.Phony: prod-dbclean
prod-dbclean:
	rm -rf ./prod-db/public && rm -rf ./prod-db/repos && rm ./prod-db/index.json && rm ./prod-db/meta.json && make prod-initdb 

.Phony: buildsearch
buildsearch:
	morsels ./db/public ./temp-morsels -c morsels_config.json && deno run -A ./build-search.ts
.Phony: prod-buildsearch
prod-buildsearch:
	morsels ./prod-db/public ./temp-morsels -c morsels_config.json && PROD=1 deno run -A ./build-search.ts
