#!/bin/sh
set -eu
task_repo=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
task_runtime=/tmp/saga-g1-runtime
task_source="$task_repo/.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/postgresql-17.4.tar.bz2"
task_hash=$(shasum -a 256 "$task_source" | cut -d ' ' -f 1)
[ "$task_hash" = c4605b73fea11963406699f949b966e5d173a7ee0ccaef8938dec0ca8a995fe7 ] || exit 1
if [ -x "$task_runtime/install/bin/postgres" ] &&
   [ -f "$task_runtime/install/lib/postgresql/pgcrypto.dylib" ] &&
   [ -f "$task_runtime/install/lib/postgresql/uuid-ossp.dylib" ]; then
  "$task_runtime/install/bin/postgres" --version
  exit 0
fi
mkdir -p "$task_runtime"
tar -xf "$task_source" -C "$task_runtime"
cd "$task_runtime"
task_openssl=$(brew --prefix openssl@3)
./postgresql-17.4/configure --prefix="$task_runtime/install" --without-readline --without-zlib --without-icu --without-lz4 --without-zstd \
  --with-openssl --with-uuid=e2fs CPPFLAGS="-I$task_openssl/include" LDFLAGS="-L$task_openssl/lib" > configure.log 2>&1
make -j4 > build.log 2>&1
make install > install.log 2>&1
make -C contrib/pgcrypto -j4 install > pgcrypto.log 2>&1
make -C contrib/uuid-ossp -j4 install > uuid.log 2>&1
"$task_runtime/install/bin/postgres" --version
