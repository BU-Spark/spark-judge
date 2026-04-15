import { getEventMode } from "../../../lib/eventModes";
import type { ReactNode } from "react";

export function PrizesTab({
    eventMode,
    savingPrizes,
    handleSavePrizes,
    prizesEdit,
    setPrizesEdit,
    categoriesForPrizeEditor,
    tracksForPrizeEditor,
    scoringLocked,
    PrizeCatalogEditor,
}: {
    eventMode?: "hackathon" | "demo_day" | "code_and_tell";
    savingPrizes: boolean;
    handleSavePrizes: () => void;
    prizesEdit: any[];
    setPrizesEdit: (value: any[]) => void;
    categoriesForPrizeEditor: string[];
    tracksForPrizeEditor: string[];
    scoringLocked: boolean;
    PrizeCatalogEditor: (props: any) => ReactNode;
}) {
    const mode = getEventMode(eventMode);

    if (mode !== "hackathon") {
        return (
            <div className="card-static p-6 bg-card space-y-4">
                <h3 className="text-lg font-heading font-semibold text-foreground">Prize Catalog</h3>
                <p className="text-sm text-muted-foreground">
                    {mode === "demo_day"
                      ? "Demo Day events use public appreciations instead of judged prizes."
                      : "Code & Tell events use one ranked-vote winner and do not use prizes."}
                </p>
            </div>
        );
    }

    return (
        <div className="card-static p-6 bg-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h3 className="text-lg font-heading font-semibold text-foreground">Prize Catalog</h3>
                    <p className="text-sm text-muted-foreground">
                        Define prize rules and scoring hints for award deliberation.
                    </p>
                </div>
                <button
                    onClick={handleSavePrizes}
                    disabled={savingPrizes || scoringLocked}
                    className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {savingPrizes ? "Saving..." : "Save Prize Catalog"}
                </button>
            </div>
            <PrizeCatalogEditor
                prizes={prizesEdit}
                setPrizes={setPrizesEdit}
                categories={categoriesForPrizeEditor}
                tracks={tracksForPrizeEditor}
                disabled={scoringLocked}
            />
            {scoringLocked && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                    Unlock scoring to edit the prize catalog.
                </p>
            )}
        </div>
    );
}
