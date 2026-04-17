import streamlit as st

def main():
    st.set_page_config(page_title="Wordship", layout="wide")  # ok here
    if "initialized" not in st.session_state:
        st.session_state.initialized = True
        # set up session_state keys here…

    try:
        from .ui import layout_builder
    except ImportError:
        import sys, pathlib
        sys.path.append(str(pathlib.Path(__file__).resolve().parent))
        from ui import layout_builder
    layout_builder()

if __name__ == "__main__":
    main()
