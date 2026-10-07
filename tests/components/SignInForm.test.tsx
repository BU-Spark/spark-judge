import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "../../src/SignInFormNew";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn }),
}));

describe("SignInForm", () => {
  beforeEach(() => signIn.mockReset());

  it("prevents duplicate sign-ins while Google is connecting", async () => {
    let resolve: () => void;
    signIn.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    const pending = screen.getByRole("button", {
      name: "Connecting to Google…",
    });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(signIn).toHaveBeenCalledOnce();
    expect(signIn).toHaveBeenCalledWith("google", {
      redirectTo: window.location.origin,
    });
    resolve!();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Sign in with Google" }),
      ).toBeEnabled(),
    );
  });

  it("allows retry after a failed sign-in", async () => {
    signIn
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(undefined);
    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
