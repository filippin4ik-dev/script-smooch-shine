import React, { Component, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type GameErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  onReset?: () => void;
};

type GameErrorBoundaryState = {
  hasError: boolean;
  error?: unknown;
};

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): GameErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("GameErrorBoundary:", error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{this.props.title ?? "Ошибка игры"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Игра не смогла загрузиться из-за ошибки. Нажмите «Назад» и попробуйте ещё раз.
          </p>
          <Button onClick={this.handleReset}>Назад к играм</Button>
        </CardContent>
      </Card>
    );
  }
}
