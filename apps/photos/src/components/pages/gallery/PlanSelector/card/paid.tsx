import { SpaceBetweenFlex } from "@ente/shared/components/Container";
import Close from "@mui/icons-material/Close";
import { IconButton, Stack } from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { t } from "i18next";
import { Trans } from "react-i18next";
import {
    convertBytesToGBs,
    hasAddOnBonus,
    isSubscriptionCancelled,
} from "utils/billing";
import { ManageSubscription } from "../manageSubscription";
import { PeriodToggler } from "../periodToggler";
import Plans from "../plans";
import { BFAddOnRow } from "../plans/BfAddOnRow";

export default function PaidSubscriptionPlanSelectorCard({
    plans,
    subscription,
    bonusData,
    closeModal,
    usage,
    planPeriod,
    togglePeriod,
    onPlanSelect,
    setLoading,
}) {
    return (
        <>
            <Box pl={1.5} py={0.5}>
                <SpaceBetweenFlex>
                    <Box>
                        <Typography variant="h3" fontWeight={"bold"}>
                            {t("SUBSCRIPTION")}
                        </Typography>
                        <Typography variant="small" color={"text.muted"}>
                            {convertBytesToGBs(subscription.storage, 2)}{" "}
                            {t("GB")}
                        </Typography>
                    </Box>
                    <IconButton onClick={closeModal} color="secondary">
                        <Close />
                    </IconButton>
                </SpaceBetweenFlex>
            </Box>

            <Box px={1.5}>
                <Typography color={"text.muted"} fontWeight={"bold"}>
                    <Trans
                        i18nKey="CURRENT_USAGE"
                        values={{
                            usage: `${convertBytesToGBs(usage, 2)} ${t("GB")}`,
                        }}
                    />
                </Typography>
            </Box>

            <Box>
                <Stack
                    spacing={3}
                    border={(theme) => `1px solid ${theme.palette.divider}`}
                    p={1.5}
                    borderRadius={(theme) => `${theme.shape.borderRadius}px`}
                >
                    <Box>
                        <PeriodToggler
                            planPeriod={planPeriod}
                            togglePeriod={togglePeriod}
                        />
                        <Typography variant="small" mt={0.5} color="text.muted">
                            {t("TWO_MONTHS_FREE")}
                        </Typography>
                    </Box>
                    <Plans
                        plans={plans}
                        planPeriod={planPeriod}
                        onPlanSelect={onPlanSelect}
                        subscription={subscription}
                        bonusData={bonusData}
                        closeModal={closeModal}
                    />
                </Stack>

                <Box py={1} px={1.5}>
                    <Typography color={"text.muted"}>
                        {!isSubscriptionCancelled(subscription)
                            ? t("RENEWAL_ACTIVE_SUBSCRIPTION_STATUS", {
                                  date: subscription.expiryTime,
                              })
                            : t("RENEWAL_CANCELLED_SUBSCRIPTION_STATUS", {
                                  date: subscription.expiryTime,
                              })}
                    </Typography>
                    {hasAddOnBonus(bonusData) && (
                        <BFAddOnRow
                            bonusData={bonusData}
                            closeModal={closeModal}
                        />
                    )}
                </Box>
            </Box>

            <ManageSubscription
                subscription={subscription}
                bonusData={bonusData}
                closeModal={closeModal}
                setLoading={setLoading}
            />
        </>
    );
}
