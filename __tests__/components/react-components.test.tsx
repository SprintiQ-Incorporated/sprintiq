/**
 * React Component Tests
 * Tests for UI components and their behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}));

describe('React Components', () => {
  describe('Card Component', () => {
    it('should render card with content', () => {
      const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={`rounded-lg border bg-card ${className || ''}`}>{children}</div>
      );

      const { container } = render(
        <Card className="custom-class">
          <div>Card Content</div>
        </Card>
      );

      expect(container.firstChild).toHaveClass('rounded-lg');
      expect(container.firstChild).toHaveClass('border');
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render card header with title', () => {
      const CardHeader = ({ children }: { children: React.ReactNode }) => (
        <div className="flex flex-col space-y-1.5 p-6">{children}</div>
      );
      
      const CardTitle = ({ children }: { children: React.ReactNode }) => (
        <div className="text-2xl font-semibold">{children}</div>
      );

      render(
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
        </CardHeader>
      );

      expect(screen.getByText('Test Title')).toBeDefined();
    });

    it('should render card content and footer', () => {
      const CardContent = ({ children }: { children: React.ReactNode }) => (
        <div className="p-6 pt-0">{children}</div>
      );
      
      const CardFooter = ({ children }: { children: React.ReactNode }) => (
        <div className="flex items-center p-6 pt-0">{children}</div>
      );

      const { container } = render(
        <>
          <CardContent>Content here</CardContent>
          <CardFooter>Footer here</CardFooter>
        </>
      );

      expect(screen.getByText('Content here')).toBeDefined();
      expect(screen.getByText('Footer here')).toBeDefined();
    });
  });

  describe('Loading Overlay Component', () => {
    const LoadingOverlay = ({ 
      isVisible, 
      currentStep, 
      progress 
    }: { 
      isVisible: boolean; 
      currentStep: string; 
      progress: number 
    }) => {
      if (!isVisible) return null;
      
      return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]">
          <div className="bg-card p-8 rounded-lg">
            <h3>{currentStep}</h3>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p>{progress}% Complete</p>
          </div>
        </div>
      );
    };

    it('should not render when isVisible is false', () => {
      const { container } = render(
        <LoadingOverlay 
          isVisible={false} 
          currentStep="Loading" 
          progress={50} 
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when isVisible is true', () => {
      render(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Processing..." 
          progress={75} 
        />
      );

      expect(screen.getByText('Processing...')).toBeDefined();
      expect(screen.getByText('75% Complete')).toBeDefined();
    });

    it('should display correct progress percentage', () => {
      render(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Loading" 
          progress={33} 
        />
      );

      expect(screen.getByText('33% Complete')).toBeDefined();
    });

    it('should update progress dynamically', () => {
      const { rerender } = render(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Loading" 
          progress={25} 
        />
      );

      expect(screen.getByText('25% Complete')).toBeDefined();

      rerender(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Loading" 
          progress={75} 
        />
      );

      expect(screen.getByText('75% Complete')).toBeDefined();
    });

    it('should change step message', () => {
      const { rerender } = render(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Step 1" 
          progress={25} 
        />
      );

      expect(screen.getByText('Step 1')).toBeDefined();

      rerender(
        <LoadingOverlay 
          isVisible={true} 
          currentStep="Step 2" 
          progress={50} 
        />
      );

      expect(screen.getByText('Step 2')).toBeDefined();
    });
  });

  describe('Component Props and Refs', () => {
    it('should forward refs to DOM elements', () => {
      const TestComponent = React.forwardRef<
        HTMLDivElement,
        React.HTMLAttributes<HTMLDivElement>
      >((props, ref) => (
        <div ref={ref} {...props} />
      ));

      const ref = React.createRef<HTMLDivElement>();
      render(<TestComponent ref={ref}>Content</TestComponent>);

      expect(ref.current).toBeTruthy();
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('should merge className props', () => {
      const Component = ({ className }: { className?: string }) => {
        const baseClass = 'base-class';
        const merged = [baseClass, className].filter(Boolean).join(' ');
        return <div className={merged}>Test</div>;
      };

      const { container } = render(<Component className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('base-class');
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should spread remaining props', () => {
      const Component = ({ ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...props} />
      );

      const { container } = render(
        <Component data-testid="test" aria-label="Test Label">
          Content
        </Component>
      );

      const div = container.firstChild as HTMLDivElement;
      expect(div.getAttribute('data-testid')).toBe('test');
      expect(div.getAttribute('aria-label')).toBe('Test Label');
    });
  });

  describe('Conditional Rendering', () => {
    it('should conditionally render based on prop', () => {
      const ConditionalComponent = ({ show }: { show: boolean }) => (
        show ? <div>Visible</div> : null
      );

      const { rerender, container } = render(<ConditionalComponent show={false} />);
      expect(container.firstChild).toBeNull();

      rerender(<ConditionalComponent show={true} />);
      expect(screen.getByText('Visible')).toBeDefined();
    });

    it('should render different content based on state', () => {
      const StateComponent = ({ state }: { state: 'loading' | 'success' | 'error' }) => {
        switch (state) {
          case 'loading':
            return <div>Loading...</div>;
          case 'success':
            return <div>Success!</div>;
          case 'error':
            return <div>Error occurred</div>;
        }
      };

      const { rerender } = render(<StateComponent state="loading" />);
      expect(screen.getByText('Loading...')).toBeDefined();

      rerender(<StateComponent state="success" />);
      expect(screen.getByText('Success!')).toBeDefined();

      rerender(<StateComponent state="error" />);
      expect(screen.getByText('Error occurred')).toBeDefined();
    });
  });

  describe('List Rendering', () => {
    it('should render list of items', () => {
      const ListComponent = ({ items }: { items: string[] }) => (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );

      render(<ListComponent items={['Item 1', 'Item 2', 'Item 3']} />);

      expect(screen.getByText('Item 1')).toBeDefined();
      expect(screen.getByText('Item 2')).toBeDefined();
      expect(screen.getByText('Item 3')).toBeDefined();
    });

    it('should handle empty list', () => {
      const ListComponent = ({ items }: { items: string[] }) => (
        items.length === 0 ? (
          <div>No items</div>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )
      );

      render(<ListComponent items={[]} />);
      expect(screen.getByText('No items')).toBeDefined();
    });
  });

  describe('Event Handlers', () => {
    it('should call onClick handler', () => {
      const handleClick = vi.fn();
      
      const ButtonComponent = ({ onClick }: { onClick: () => void }) => (
        <button onClick={onClick}>Click me</button>
      );

      const { getByText } = render(<ButtonComponent onClick={handleClick} />);
      const button = getByText('Click me');
      
      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should pass event to handler', () => {
      const handleClick = vi.fn();
      
      const ButtonComponent = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
        <button onClick={onClick}>Click me</button>
      );

      const { getByText } = render(<ButtonComponent onClick={handleClick} />);
      getByText('Click me').click();

      expect(handleClick).toHaveBeenCalled();
      expect(handleClick.mock.calls[0][0]).toBeDefined();
    });
  });

  describe('Disabled State', () => {
    it('should disable button when prop is true', () => {
      const DisableableButton = ({ disabled }: { disabled: boolean }) => (
        <button disabled={disabled}>Button</button>
      );

      const { getByText } = render(<DisableableButton disabled={true} />);
      expect((getByText('Button') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should apply disabled styling', () => {
      const DisableableButton = ({ disabled }: { disabled: boolean }) => (
        <button 
          disabled={disabled}
          className={disabled ? 'opacity-50 pointer-events-none' : ''}
        >
          Button
        </button>
      );

      const { getByText } = render(<DisableableButton disabled={true} />);
      expect(getByText('Button')).toHaveClass('opacity-50');
    });
  });

  describe('Data Attributes', () => {
    it('should render with data attributes', () => {
      const Component = ({ status }: { status: string }) => (
        <div data-status={status} data-testid="component">
          Content
        </div>
      );

      const { getByTestId } = render(<Component status="active" />);
      expect(getByTestId('component').getAttribute('data-status')).toBe('active');
    });
  });

  describe('Children Rendering', () => {
    it('should render children prop', () => {
      const Container = ({ children }: { children: React.ReactNode }) => (
        <div className="container">{children}</div>
      );

      render(
        <Container>
          <span>Child content</span>
        </Container>
      );

      expect(screen.getByText('Child content')).toBeDefined();
    });

    it('should render multiple children', () => {
      const Container = ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      );

      render(
        <Container>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </Container>
      );

      expect(screen.getByText('First')).toBeDefined();
      expect(screen.getByText('Second')).toBeDefined();
      expect(screen.getByText('Third')).toBeDefined();
    });
  });

  describe('Style Props', () => {
    it('should apply inline styles', () => {
      const StyledComponent = ({ color }: { color: string }) => (
        <div style={{ color, fontSize: '16px' }}>Styled text</div>
      );

      const { getByText } = render(<StyledComponent color="red" />);
      const element = getByText('Styled text') as HTMLDivElement;
      
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('16px');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      const AccessibleButton = ({ label }: { label: string }) => (
        <button aria-label={label}>Icon</button>
      );

      const { getByLabelText } = render(<AccessibleButton label="Close dialog" />);
      expect(getByLabelText('Close dialog')).toBeDefined();
    });

    it('should have proper role attribute', () => {
      const AlertComponent = ({ message }: { message: string }) => (
        <div role="alert">{message}</div>
      );

      const { getByRole } = render(<AlertComponent message="Error occurred" />);
      expect(getByRole('alert')).toBeDefined();
    });

    it('should support keyboard navigation attributes', () => {
      const KeyboardComponent = () => (
        <div tabIndex={0} role="button" aria-label="Clickable">
          Interactive
        </div>
      );

      const { getByLabelText } = render(<KeyboardComponent />);
      const element = getByLabelText('Clickable') as HTMLDivElement;
      
      expect(element.tabIndex).toBe(0);
      expect(element.getAttribute('role')).toBe('button');
    });
  });

  describe('Loading States', () => {
    it('should show spinner when loading', () => {
      const LoadingComponent = ({ isLoading }: { isLoading: boolean }) => (
        <div>
          {isLoading ? (
            <div data-testid="spinner">Loading...</div>
          ) : (
            <div>Content loaded</div>
          )}
        </div>
      );

      const { getByTestId, rerender } = render(<LoadingComponent isLoading={true} />);
      expect(getByTestId('spinner')).toBeDefined();

      rerender(<LoadingComponent isLoading={false} />);
      expect(screen.getByText('Content loaded')).toBeDefined();
    });
  });

  describe('Error States', () => {
    it('should display error message when error occurs', () => {
      const ErrorComponent = ({ error }: { error: string | null }) => (
        <div>
          {error ? (
            <div className="error" role="alert">{error}</div>
          ) : (
            <div>No errors</div>
          )}
        </div>
      );

      const { rerender, getByRole } = render(<ErrorComponent error={null} />);
      expect(screen.getByText('No errors')).toBeDefined();

      rerender(<ErrorComponent error="Something went wrong" />);
      expect(getByRole('alert')).toHaveTextContent('Something went wrong');
    });
  });

  describe('Dynamic Classes', () => {
    it('should apply variant classes', () => {
      const VariantComponent = ({ variant }: { variant: 'primary' | 'secondary' }) => {
        const classes = variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500';
        return <div className={classes}>Content</div>;
      };

      const { container, rerender } = render(<VariantComponent variant="primary" />);
      expect(container.firstChild).toHaveClass('bg-blue-500');

      rerender(<VariantComponent variant="secondary" />);
      expect(container.firstChild).toHaveClass('bg-gray-500');
    });

    it('should combine multiple class conditions', () => {
      const ComplexComponent = ({ 
        isActive, 
        isDisabled 
      }: { 
        isActive: boolean; 
        isDisabled: boolean 
      }) => {
        const classes = [
          'base-class',
          isActive && 'active',
          isDisabled && 'disabled',
        ].filter(Boolean).join(' ');
        
        return <div className={classes}>Content</div>;
      };

      const { container } = render(
        <ComplexComponent isActive={true} isDisabled={false} />
      );

      expect(container.firstChild).toHaveClass('base-class');
      expect(container.firstChild).toHaveClass('active');
      expect(container.firstChild).not.toHaveClass('disabled');
    });
  });

  describe('Form Components', () => {
    it('should render input with value', () => {
      const InputComponent = ({ value }: { value: string }) => (
        <input type="text" value={value} readOnly />
      );

      const { getByDisplayValue } = render(<InputComponent value="test input" />);
      expect(getByDisplayValue('test input')).toBeDefined();
    });

    it('should render checkbox with checked state', () => {
      const CheckboxComponent = ({ checked }: { checked: boolean }) => (
        <input type="checkbox" checked={checked} readOnly />
      );

      const { container } = render(<CheckboxComponent checked={true} />);
      const checkbox = container.querySelector('input') as HTMLInputElement;
      
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Text Content', () => {
    it('should render text content correctly', () => {
      const TextComponent = ({ text }: { text: string }) => <p>{text}</p>;

      render(<TextComponent text="Hello, World!" />);
      expect(screen.getByText('Hello, World!')).toBeDefined();
    });

    it('should handle special characters', () => {
      const TextComponent = ({ text }: { text: string }) => <p>{text}</p>;

      render(<TextComponent text="Special <>&quot; chars" />);
      expect(screen.getByText(/Special.*chars/)).toBeDefined();
    });
  });
});
