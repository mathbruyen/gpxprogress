# Environment setup using nix:
# https://github.com/mathbruyen/computers/tree/master/nix

{ pkgs ? import ~/.nix-local/allpackages.nix {} }:

pkgs.stdenv.mkDerivation rec {
  name = "dev";
  buildInputs = [ pkgs.nodejs ];
  src = ./.;
}
