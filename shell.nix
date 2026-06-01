let
  pkgs = import <nixpkgs> { };
  python = pkgs.python313;
  pythonPackages = python.pkgs;
in
with pkgs;
mkShell {
  packages = [
    python313Packages.edge-tts
    pythonPackages.venvShellHook
  ];

  buildInputs = [
    readline
    libffi
    git
    stdenv.cc.cc
  ];

  shellHook = ''
    SOURCE_DATE_EPOCH=$(date +%s)
    VENV=.venv

    if test ! -d $VENV; then
      python3.13 -m venv $VENV
    fi
    source ./$VENV/bin/activate
    export PYTHONPATH=`pwd`/$VENV/${python.sitePackages}/:$PYTHONPATH
    # pip3 install -r requirements.txt
  '';

  postShellHook = ''
    ln -sf ${python.sitePackages}/* ./.venv/lib/python3.13/site-packages
  '';
}
