# run.py — top-level entry point so absolute imports are safe.
import streamlit as st
from app.ui import layout_builder

def main():
    layout_builder()

if __name__ == "__main__":
    main()
