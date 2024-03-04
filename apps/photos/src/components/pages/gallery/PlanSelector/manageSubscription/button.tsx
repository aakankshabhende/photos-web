import { FluidContainer } from "@ente/shared/components/Container";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { Button, ButtonProps } from "@mui/material";

const ManageSubscriptionButton = ({ children, ...props }: ButtonProps) => (
    <Button size="large" endIcon={<ChevronRight />} {...props}>
        <FluidContainer>{children}</FluidContainer>
    </Button>
);

export default ManageSubscriptionButton;
