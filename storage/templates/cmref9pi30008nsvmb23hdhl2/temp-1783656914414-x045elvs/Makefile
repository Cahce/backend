# Makefile — biên dịch nhanh bằng Typst CLI.
#
#   make pdf     # biên dịch ra main.pdf
#   make watch   # tự biên dịch lại khi sửa file
#   make clean   # xoá build tạm

MAIN  := main.typ
OUT   := main.pdf
FONTS := assets/fonts

.PHONY: pdf watch clean

pdf:
	typst compile --font-path $(FONTS) $(MAIN) $(OUT)

watch:
	typst watch --font-path $(FONTS) $(MAIN) $(OUT)

clean:
	rm -rf build out
