import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Check, Copy } from "lucide-static";

function resize_icon(svg: string, size: number): string {
  return svg
    .replace(/width="24"/, `width="${String(size)}"`)
    .replace(/height="24"/, `height="${String(size)}"`);
}

const COPY_SVG = resize_icon(Copy, 14);
const CHECK_SVG = resize_icon(Check, 14);

const code_block_copy_key = new PluginKey("code-block-copy");

function create_copy_button(code_el: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "code-block-copy";
  button.contentEditable = "false";
  button.type = "button";
  button.setAttribute("aria-label", "Copy code");
  button.innerHTML = COPY_SVG;

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = code_el.textContent ?? "";

    void navigator.clipboard.writeText(text).then(() => {
      button.innerHTML = CHECK_SVG;
      button.classList.add("code-block-copy--copied");
      setTimeout(() => {
        button.innerHTML = COPY_SVG;
        button.classList.remove("code-block-copy--copied");
      }, 1500);
    });
  });

  return button;
}

export const code_block_copy_plugin = $prose(
  () =>
    new Plugin({
      key: code_block_copy_key,
      props: {
        nodeViews: {
          code_block: (node) => {
            const pre = document.createElement("pre");
            const code = document.createElement("code");

            if (node.attrs.language) {
              code.classList.add(`language-${String(node.attrs.language)}`);
            }

            pre.appendChild(code);
            pre.appendChild(create_copy_button(code));

            return {
              dom: pre,
              contentDOM: code,
              update: (updated) => {
                if (updated.type.name !== "code_block") return false;
                code.className = updated.attrs.language
                  ? `language-${String(updated.attrs.language)}`
                  : "";
                return true;
              },
              stopEvent: (event) =>
                event.target instanceof HTMLElement &&
                event.target.closest(".code-block-copy") !== null,
            };
          },
        },
      },
    }),
);
