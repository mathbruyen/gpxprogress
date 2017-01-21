{ pkgs ? import <nixpkgs> {} }:

pkgs.stdenv.mkDerivation rec {
  name = "dev";
  buildInputs = [ pkgs.nodejs-7_x ];
  src = ./src;
}
