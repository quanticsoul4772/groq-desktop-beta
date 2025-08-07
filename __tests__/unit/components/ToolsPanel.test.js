import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
/* eslint-disable-next-line no-unused-vars */
import ToolsPanel from '../../../src/renderer/components/ToolsPanel';


describe('ToolsPanel', () => {
  const mockTools = [
    {
      name: 'file_search',
      description: 'Search for files in the workspace',
      category: 'filesystem',
    },
    {
      name: 'web_browser',
      description: 'Browse web pages and extract content',
      category: 'web',
    },
    {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      category: 'utility',
    },
  ];

  const defaultProps = {
    isOpen: false,
    onClose: jest.fn(),
    tools: mockTools,
    onToolSelect: jest.fn(),
    selectedTools: [],
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders closed panel by default', () => {
    render(<ToolsPanel {...defaultProps} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders open panel when isOpen is true', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/mcp tools/i)).toBeInTheDocument();
  });

  test('displays list of available tools', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    expect(screen.getByText('file_search')).toBeInTheDocument();
    expect(screen.getByText('web_browser')).toBeInTheDocument();
    expect(screen.getByText('calculator')).toBeInTheDocument();
  });

  test('shows tool descriptions', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    expect(screen.getByText('Search for files in the workspace')).toBeInTheDocument();
    expect(screen.getByText('Browse web pages and extract content')).toBeInTheDocument();
  });

  test('groups tools by category', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    expect(screen.getByText('filesystem')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('utility')).toBeInTheDocument();
  });

  test('handles tool selection', async () => {
    const user = userEvent.setup();
    const mockToolSelect = jest.fn();

    render(<ToolsPanel {...defaultProps} isOpen={true} onToolSelect={mockToolSelect} />);

    const toolCheckbox = screen.getByRole('checkbox', { name: /file_search/i });
    await user.click(toolCheckbox);

    expect(mockToolSelect).toHaveBeenCalledWith('file_search');
  });

  test('shows selected tools as checked', () => {
    render(
      <ToolsPanel {...defaultProps} isOpen={true} selectedTools={['file_search', 'calculator']} />
    );

    const fileSearchCheckbox = screen.getByRole('checkbox', { name: /file_search/i });
    const calculatorCheckbox = screen.getByRole('checkbox', { name: /calculator/i });
    const webBrowserCheckbox = screen.getByRole('checkbox', { name: /web_browser/i });

    expect(fileSearchCheckbox).toBeChecked();
    expect(calculatorCheckbox).toBeChecked();
    expect(webBrowserCheckbox).not.toBeChecked();
  });

  test('closes panel when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(<ToolsPanel {...defaultProps} isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows loading state', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} loading={true} />);

    expect(screen.getByText(/loading tools/i)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('shows empty state when no tools available', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} tools={[]} />);

    expect(screen.getByText(/no tools available/i)).toBeInTheDocument();
  });

  test('filters tools by search query', async () => {
    const user = userEvent.setup();

    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    const searchInput = screen.getByPlaceholderText(/search tools/i);
    await user.type(searchInput, 'file');

    expect(screen.getByText('file_search')).toBeInTheDocument();
    expect(screen.queryByText('web_browser')).not.toBeInTheDocument();
    expect(screen.queryByText('calculator')).not.toBeInTheDocument();
  });

  test('shows tool count', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    expect(screen.getByText(/3 tools available/i)).toBeInTheDocument();
  });

  test('handles select all functionality', async () => {
    const user = userEvent.setup();
    const mockToolSelect = jest.fn();

    render(<ToolsPanel {...defaultProps} isOpen={true} onToolSelect={mockToolSelect} />);

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    await user.click(selectAllButton);

    expect(mockToolSelect).toHaveBeenCalledTimes(3);
  });

  test('handles deselect all functionality', async () => {
    const user = userEvent.setup();
    const mockToolSelect = jest.fn();

    render(
      <ToolsPanel
        {...defaultProps}
        isOpen={true}
        onToolSelect={mockToolSelect}
        selectedTools={['file_search', 'calculator']}
      />
    );

    const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
    await user.click(deselectAllButton);

    expect(mockToolSelect).toHaveBeenCalledTimes(2);
  });

  test('closes on overlay click', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(<ToolsPanel {...defaultProps} isOpen={true} onClose={mockOnClose} />);

    const overlay = screen.getByTestId('panel-overlay');
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(<ToolsPanel {...defaultProps} isOpen={true} onClose={mockOnClose} />);

    // Press Escape to close
    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('focuses search input when opened', () => {
    render(<ToolsPanel {...defaultProps} isOpen={true} />);

    const searchInput = screen.getByPlaceholderText(/search tools/i);
    expect(searchInput).toHaveFocus();
  });

  test('shows tool status indicators', () => {
    const toolsWithStatus = [
      {
        name: 'active_tool',
        description: 'Active tool',
        status: 'active',
      },
      {
        name: 'error_tool',
        description: 'Tool with error',
        status: 'error',
      },
    ];

    render(<ToolsPanel {...defaultProps} isOpen={true} tools={toolsWithStatus} />);

    expect(screen.getByTestId('tool-status-active')).toBeInTheDocument();
    expect(screen.getByTestId('tool-status-error')).toBeInTheDocument();
  });
});
