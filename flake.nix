{
  description = "Offline way to quiz with friends!";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    fenix,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        overlays = [fenix.overlays.default];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        toolchainW = fenix.packages.${system}.combine [
          fenix.packages.${system}.stable.toolchain
          fenix.packages.${system}.targets.x86_64-pc-windows-gnu.stable.rust-std
        ];
      in
        with pkgs; rec {
          devShells.default = mkShell rec {
            nativeBuildInputs = [
              pkg-config
              toolchainW
              pkgs.cargo-cross

              pkgs.pkgsCross.mingwW64.stdenv.cc
            ];

            buildInputs = [];

            LD_LIBRARY_PATH = nixpkgs.lib.makeLibraryPath buildInputs;
            CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "${pkgs.pkgsCross.mingwW64.stdenv.cc}/bin/x86_64-w64-mingw32-gcc";
          };
          packages = let
            toolchain = fenix.packages.${system}.stable.toolchain;
            rustPlatform = pkgs.makeRustPlatform {
              cargo = toolchain;
              rustc = toolchain;
            };
          in rec {
            qurio = rustPlatform.buildRustPackage {
              pname = "Qurio";
              version = "0.1.0";

              src = ./.;

              cargoLock = {
                lockFile = ./Cargo.lock;
              };

              nativeBuildInputs = with pkgs; [
                makeWrapper
                pkg-config
              ];

              buildInputs = [];

              cargoBuildFlags = ["--bin" "qurio"];
            };
            default = qurio;
          };

          apps = rec {
            qurio = flake-utils.lib.mkApp {drv = packages.qurio;};
            default = qurio;
          };
        }
    );
}
