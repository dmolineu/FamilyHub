import { colorMap } from "@/lib/types";
import { render, screen } from "@/test/test-utils";
import { MemberAvatar } from "./member-avatar";

describe("MemberAvatar", () => {
  it("renders member initial", () => {
    render(<MemberAvatar name="Alice" color="coral" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("applies member color as background", () => {
    render(<MemberAvatar name="Alice" color="coral" />);
    const el = screen.getByText("A");
    expect(el).toHaveClass("bg-[#b95443]");
  });

  it("fills the circle with a custom colour", () => {
    render(<MemberAvatar name="Gil" color="#4a90d9" />);
    expect(screen.getByText("G")).toHaveClass("bg-[#4a90d9]");
  });

  it("renders at default size (24px)", () => {
    render(<MemberAvatar name="Bob" color="teal" />);
    const el = screen.getByText("B");
    expect(el).toHaveClass("w-6", "h-6");
  });

  it("renders at custom size", () => {
    render(<MemberAvatar name="Bob" color="teal" size="sm" />);
    const el = screen.getByText("B");
    expect(el).toHaveClass("w-5", "h-5");
  });

  it("renders ring variant (outline, no fill)", () => {
    render(<MemberAvatar name="Carol" color="green" variant="ring" />);
    const el = screen.getByText("C");
    expect(el).toHaveClass("border-2");
    expect(el).not.toHaveClass("bg-[#467c4b]");
  });

  it("shows an uploaded photo or chosen character instead of the initial", () => {
    const { container } = render(
      <MemberAvatar
        name="Dana"
        color="pink"
        avatarUrl="data:image/png;base64,iVBORw0KGgo="
      />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(screen.queryByText("D")).not.toBeInTheDocument();
  });

  it("falls back to the initial when a linked picture fails to load", () => {
    const { container } = render(
      <MemberAvatar
        name="Dana"
        color="pink"
        avatarUrl="https://example.com/gone.png"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    img?.dispatchEvent(new Event("error"));
    return screen.findByText("D");
  });

  it("draws a built-in picture on the member's colour", () => {
    const { container } = render(
      <MemberAvatar name="Eli" color="teal" avatarUrl="builtin:fox" />,
    );
    expect(
      container.querySelector('svg[data-avatar-key="fox"]'),
    ).not.toBeNull();
    expect(container.firstElementChild).toHaveClass(colorMap.teal.bg);
  });

  it("shows the initial for a built-in picture this version does not know", () => {
    render(<MemberAvatar name="Eli" color="teal" avatarUrl="builtin:dragon" />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("lets the caller size it", () => {
    render(<MemberAvatar name="Fay" color="teal" className="h-20 w-20" />);
    expect(screen.getByText("F")).toHaveClass("h-20", "w-20");
    expect(screen.getByText("F")).not.toHaveClass("w-6");
  });
});
