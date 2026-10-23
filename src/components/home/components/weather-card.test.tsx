import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testWeather } from "@/test/fixtures/weather";
import { WeatherCard } from "./weather-card";

describe("WeatherCard (large)", () => {
  it("shows current conditions, the place, and the coming days", () => {
    render(<WeatherCard variant="large" weather={testWeather} />);

    const region = screen.getByRole("region", { name: /weather/i });
    expect(within(region).getByText("72°")).toBeInTheDocument();
    expect(within(region).getByText("Partly cloudy")).toBeInTheDocument();
    expect(
      within(region).getByText("San Diego, California"),
    ).toBeInTheDocument();

    const days = within(region).getAllByRole("listitem");
    expect(days).toHaveLength(3);
    expect(days[0]).toHaveTextContent("Today");
    expect(days[0]).toHaveTextContent("75°");
    expect(days[0]).toHaveTextContent("61°");
    expect(days[1]).toHaveTextContent("Mon");
    expect(days[1]).toHaveTextContent("80%");
    // No chance value means no percentage, not "0%".
    expect(days[2]).not.toHaveTextContent("%");
  });

  it("explains how to turn weather on when no location is set", () => {
    render(<WeatherCard variant="large" weather={undefined} />);

    expect(
      screen.getByText(/add a location in preferences/i),
    ).toBeInTheDocument();
  });

  it("shows a loading state before the first forecast", () => {
    render(<WeatherCard variant="large" weather={undefined} isLoading />);

    expect(screen.getByText(/loading weather/i)).toBeInTheDocument();
  });
});

describe("WeatherCard (compact)", () => {
  it("fits the conditions on one line", () => {
    render(<WeatherCard variant="compact" weather={testWeather} />);

    const line = screen.getByRole("region", { name: /weather/i });
    expect(line).toHaveTextContent("72°");
    expect(line).toHaveTextContent("Partly cloudy");
    expect(line).toHaveTextContent("H 75°");
    expect(line).toHaveTextContent("L 61°");
  });

  it("renders nothing without a location", () => {
    const { container } = render(
      <WeatherCard variant="compact" weather={undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
