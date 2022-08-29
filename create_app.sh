#!/usr/bin/env bash

set -euxo pipefail

if [[ "$#" -ne 1 ]]; then
    echo "Please specify a package name"
    exit 1
fi

APP=$1

echo "Creating app ${APP}"
npx wrangler init packages/${APP} -y 

cat << EOF >> packages/${APP}/wrangler.toml
routes = [
	{ pattern = "${APP}.mirio.dev", custom_domain = true }
]
EOF