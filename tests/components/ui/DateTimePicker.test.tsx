import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { render, screen } from "../../../tests/setup/test-utils";

function ControlledDateTimePicker({
  label,
  initialValue,
  onChange,
}: {
  label: string;
  initialValue: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <DateTimePicker
      label={label}
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange?.(nextValue);
      }}
    />
  );
}

describe("DateTimePicker", () => {
  it("shows a placeholder and disables time entry until a date is selected", () => {
    render(
      <DateTimePicker
        label="Start date and time"
        value=""
        onChange={vi.fn()}
        placeholder="Select a start date"
      />
    );

    expect(
      screen.getByRole("button", { name: "Start date and time date" })
    ).toHaveTextContent("Select a start date");
    expect(
      screen.getByRole("button", { name: "Start date and time time" })
    ).toBeDisabled();
  });

  it("keeps the existing time when a new calendar day is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DateTimePicker
        label="Start date and time"
        value="2026-04-13T09:30"
        onChange={onChange}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Start date and time date" })
    );
    await user.click(
      screen.getByRole("button", { name: /April 18, 2026/i })
    );

    expect(onChange).toHaveBeenCalledWith("2026-04-18T09:30");
  });

  it("keeps the selected date when the time changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ControlledDateTimePicker
        label="End date and time"
        initialValue="2026-04-13T09:30"
        onChange={onChange}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "End date and time time" })
    );
    await user.click(screen.getByRole("button", { name: "14" }));
    await user.click(screen.getByRole("button", { name: "45" }));

    expect(onChange).toHaveBeenLastCalledWith("2026-04-13T14:45");
  });
});
